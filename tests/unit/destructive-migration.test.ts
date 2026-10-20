import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testDestructiveMigrationRuleReportsEachFramework(): void {
  const findings = migrationFindings([
    file("db/migrate/20261020_drop_legacy.rb", [
      "class DropLegacy < ActiveRecord::Migration[7.1]",
      "  def change",
      "    drop_table :legacy_orders",
      "    remove_column :users, :nickname, :string",
      "  end",
      "end"
    ]),
    file("app/migrations/0007_remove_field.py", [
      "operations = [",
      "    migrations.RemoveField(model_name='user', name='nickname'),",
      "    migrations.RenameModel('Order', 'Purchase'),",
      "]"
    ]),
    file("alembic/versions/abc123_drop.py", ["def upgrade():", "    op.drop_column('users', 'nickname')"]),
    file("migrations/20261020_users.js", [
      "exports.up = function (knex) {",
      "  return knex.schema.table('users', (table) => table.renameColumn('name', 'full_name'));",
      "};"
    ]),
    file("database/migrations/2026_10_20_change_users.php", [
      "public function up(): void",
      "{",
      "    Schema::table('users', function (Blueprint $table) {",
      "        $table->string('name', 50)->change();",
      "    });",
      "}"
    ]),
    file("Migrations/20261020_DropOrders.cs", [
      "protected override void Up(MigrationBuilder migrationBuilder)",
      "{",
      "    migrationBuilder.DropTable(name: \"Orders\");",
      "}"
    ]),
    file("priv/repo/migrations/20261020_rename.exs", [
      "def change do",
      "  rename table(\"users\"), :name, to: :full_name",
      "end"
    ]),
    file("prisma/migrations/20261020_cleanup/migration.sql", [
      "-- Remove the unused column",
      "ALTER TABLE \"User\" DROP COLUMN \"nickname\";",
      "TRUNCATE TABLE audit_log;",
      "DELETE FROM sessions;",
      "ALTER TABLE orders ALTER COLUMN total TYPE numeric(12, 2);",
      "ALTER TABLE orders RENAME COLUMN total TO amount;"
    ])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity, finding.title]).sort(),
    [
      ["db/migrate/20261020_drop_legacy.rb", 3, "high", "Destructive migration added"],
      ["app/migrations/0007_remove_field.py", 2, "high", "Destructive migration added"],
      ["alembic/versions/abc123_drop.py", 2, "high", "Destructive migration added"],
      ["migrations/20261020_users.js", 2, "warning", "Breaking schema change added"],
      ["database/migrations/2026_10_20_change_users.php", 4, "warning", "Breaking schema change added"],
      ["Migrations/20261020_DropOrders.cs", 3, "high", "Destructive migration added"],
      ["priv/repo/migrations/20261020_rename.exs", 2, "warning", "Breaking schema change added"],
      ["prisma/migrations/20261020_cleanup/migration.sql", 2, "high", "Destructive migration added"]
    ].sort()
  );
  const message = (path: string) => findings.find((finding) => finding.file === path)?.message;
  assert.equal(
    message("db/migrate/20261020_drop_legacy.rb"),
    "Lines 3, 4 change the database in ways that are hard to undo: drops a table, drops a column."
  );
  assert.equal(
    message("migrations/20261020_users.js"),
    "Line 2 changes the database in a way that is hard to undo: renames a table or column."
  );
  assert.equal(
    message("prisma/migrations/20261020_cleanup/migration.sql"),
    "Lines 2, 3, 4, 5, 6 change the database in ways that are hard to undo: drops a column, removes every row, changes a column definition, renames a table or column."
  );
}

export function testDestructiveMigrationRuleIgnoresRollbackSections(): void {
  const findings = migrationFindings([
    file("db/migrate/20261020_create_orders.rb", [
      "class CreateOrders < ActiveRecord::Migration[7.1]",
      "  def up",
      "    create_table :orders",
      "  end",
      "",
      "  def down",
      "    drop_table :orders",
      "  end",
      "end"
    ]),
    file("alembic/versions/def456_create.py", [
      "def upgrade():",
      "    op.create_table('orders')",
      "",
      "def downgrade():",
      "    op.drop_table('orders')"
    ]),
    file("migrations/20261020_orders.ts", [
      "export async function up(knex: Knex): Promise<void> {",
      "  await knex.schema.createTable('orders', () => {});",
      "}",
      "export async function down(knex: Knex): Promise<void> {",
      "  await knex.schema.dropTable('orders');",
      "}"
    ]),
    file("database/migrations/2026_10_20_create_orders.php", [
      "public function down(): void",
      "{",
      "    Schema::dropIfExists('orders');",
      "}"
    ]),
    file("Migrations/20261020_CreateOrders.cs", [
      "protected override void Down(MigrationBuilder migrationBuilder)",
      "{",
      "    migrationBuilder.DropTable(name: \"Orders\");",
      "}"
    ]),
    file("db/migrations/00001_create_orders.sql", [
      "-- +goose Up",
      "CREATE TABLE orders (id bigint);",
      "-- +goose Down",
      "DROP TABLE orders;"
    ]),
    file("db/migrations/00002_create_orders.down.sql", ["DROP TABLE orders;"]),
    file("migrations/2026-10-20-orders/down.sql", ["DROP TABLE orders;"])
  ]);

  assert.deepEqual(findings, []);
}

export function testDestructiveMigrationRuleUsesTheHunkHeaderForContext(): void {
  // Git names the enclosing function after `@@`, so a hunk inside `downgrade` is still a rollback.
  const patch = ["@@ -12,2 +12,3 @@ def downgrade():", "     op.drop_index('ix_orders')", "+    op.drop_table('orders')"].join("\n");
  const later = ["@@ -12,2 +12,3 @@ def upgrade():", "     op.add_column('orders', sa.Column('x'))", "+    op.drop_table('orders')"].join("\n");

  const findings = migrationFindings([
    { path: "alembic/versions/a_down.py", status: "modified", additions: 1, deletions: 0, patch },
    { path: "alembic/versions/b_up.py", status: "modified", additions: 1, deletions: 0, patch: later }
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [["alembic/versions/b_up.py", 13]]
  );
}

export function testDestructiveMigrationRuleIgnoresSafeChangesAndOtherFiles(): void {
  const findings = migrationFindings([
    file("db/migrate/20261020_add_index.rb", [
      "class AddIndex < ActiveRecord::Migration[7.1]",
      "  def change",
      "    # drop_table :old_orders once the backfill is done",
      "    add_column :users, :nickname, :string",
      "    change_column_null :users, :email, false",
      "    change_column_default :users, :role, from: nil, to: 'member'",
      "    remove_index :users, :email",
      "  end",
      "end"
    ]),
    file("prisma/migrations/20261020_safe/migration.sql", [
      "ALTER TABLE orders ALTER COLUMN total SET DEFAULT 0;",
      "ALTER TABLE orders ALTER COLUMN total DROP NOT NULL;",
      "DELETE FROM sessions WHERE expires_at < now();",
      "DROP INDEX orders_total_idx;"
    ]),
    // Dumps and queries are not migrations, even when they drop tables.
    file("db/dump.sql", ["DROP TABLE IF EXISTS orders;"]),
    file("src/cleanup.ts", ["await db.raw('TRUNCATE TABLE sessions');"]),
    file("docs/migrations.md", ["Run `DROP TABLE orders;` only after the backfill."]),
    file("tests/migrations/fixtures.test.ts", ["await knex.schema.dropTable('orders');"])
  ]);

  assert.deepEqual(findings, []);
}

export function testDestructiveMigrationRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { destructiveMigration: { enabled: false } } });
  const files = [file("db/migrate/1_drop.rb", ["drop_table :orders"])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "destructive-migration"));
}

function migrationFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter(
    (finding) => finding.ruleId === "destructive-migration"
  );
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
