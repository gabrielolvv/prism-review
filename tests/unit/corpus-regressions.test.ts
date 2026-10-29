import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";

// Lines from popular open-source packages that rules used to report wrongly, and the closest
// lines that must still be reported. They were found by running every rule over the files of about
// forty npm, PyPI, and RubyGems packages as if a pull request added them.

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function ruleIds(path: string, lines: string[]): string[] {
  return analyzePullRequest([added(path, lines)], defaultConfig).findings.map((finding) => finding.ruleId);
}

export function testMinifiedBundlesAreNotReadAsWeakCrypto(): void {
  const bundle = `!function(e){var token=Math.random().toString(36);${"x".repeat(600)}}();`;
  assert.ok(!ruleIds("dist/socket.io.min.js", [bundle]).includes("weak-crypto"));
  assert.ok(!ruleIds("static/vendor.js", [bundle]).includes("weak-crypto"));
  assert.ok(ruleIds("src/reset.js", ["const resetToken = Math.random().toString(36);"]).includes("weak-crypto"));
}

export function testPythonNamesAreNotReadAsRailsInput(): void {
  // Django's login view assigns a variable named redirect_to; Ansible modules read `params[...]`.
  assert.ok(!ruleIds("django/contrib/auth/views.py", ["redirect_to = self.request.POST.get(self.redirect_field_name)"]).includes("untrusted-input"));
  assert.ok(!ruleIds("ansible/modules/copy.py", ["b_src = to_bytes(os.path.join(module.params['src'], ''))"]).includes("untrusted-input"));
  assert.ok(ruleIds("app/controllers/sessions_controller.rb", ["redirect_to params[:return_to]"]).includes("untrusted-input"));
}

export function testReadingTheUmaskIsNotReported(): void {
  // Setting the umask to read it, then restoring it, is the only way to read it in Python.
  assert.ok(!ruleIds("django/core/management/templates.py", ["current_umask = os.umask(0)"]).includes("file-permissions"));
  assert.ok(!ruleIds("lib/util.py", ["    return os.umask(0)"]).includes("file-permissions"));
  assert.ok(ruleIds("scripts/setup.py", ["os.umask(0)"]).includes("file-permissions"));
}

export function testExampleProjectsAreNotProductionSettings(): void {
  assert.ok(!ruleIds("examples/django/proj/settings.py", ["DEBUG = True"]).includes("insecure-web-config"));
  assert.ok(ruleIds("proj/settings.py", ["DEBUG = True"]).includes("insecure-web-config"));
}

export function testPublishConfigIsNotADependency(): void {
  const manifest = added("package.json", ['  "publishConfig": {', '    "tag": "latest",', '    "registry": "https://registry.npmjs.org/"', "  },"]);
  assert.deepEqual(dependencyChanges([manifest]), []);
}

export function testPackageMetadataIsNotADependency(): void {
  // Prism Review's own package.json, when it gained its repository and homepage.
  const metadata = added("package.json", [
    '  "homepage": "https://github.com/gabrielolvv/prism-review#readme",',
    '  "repository": {',
    '    "type": "git",',
    '    "url": "git+https://github.com/gabrielolvv/prism-review.git"',
    "  },",
    '  "bugs": "https://github.com/gabrielolvv/prism-review/issues",',
    '  "engines": {',
    '    "node": ">=22",',
    '    "custom-runtime": "^1.0.0"',
    "  },",
    // axios's bundle size limits.
    '  "bundlesize": [',
    "    {",
    '      "path": "./dist/axios.min.js",',
    '      "threshold": "5kB"',
    "    }",
    "  ],"
  ]);
  assert.deepEqual(dependencyChanges([metadata]), []);

  // This release's own change, which turned `dependencies` into package metadata.
  const replaced: ChangedFile = {
    path: "package.json",
    status: "modified",
    additions: 4,
    deletions: 2,
    patch: [
      "@@ -26,4 +26,6 @@",
      '   "license": "MIT",',
      '-  "dependencies": {',
      '+  "repository": {',
      '+    "url": "git+https://github.com/gabrielolvv/prism-review.git"',
      "+  },",
      '+  "homepage": "https://github.com/gabrielolvv/prism-review#readme",',
      '+  "devDependencies": {',
      '     "zod": "^4.6.7"'
    ].join("\n")
  };
  assert.deepEqual(dependencyChanges([replaced]), []);

  // Inside a dependencies object, `url` is the npm package of that name.
  const dependencies = added("package.json", ['  "dependencies": {', '    "url": "^0.11.0",', '    "custom-runtime": "^1.0.0"', "  },"]);
  assert.deepEqual(
    dependencyChanges([dependencies]).map((change) => change.name),
    ["url", "custom-runtime"]
  );
}

export function testPopularPackagesNamedLikeOthersAreNotLookalikes(): void {
  const manifest = added("package.json", ['  "dependencies": {', '    "cookies": "~0.9.0",', '    "mquery": "5.0.0"', "  }"]);
  assert.ok(!analyzePullRequest([manifest], defaultConfig).findings.some((finding) => finding.ruleId === "lookalike-dependency"));
}

export function testTranslationCatalogsMayUseDirectionMarks(): void {
  const zeroWidthSpace = String.fromCodePoint(0x200b);
  const rightToLeftMark = String.fromCodePoint(0x202b);
  const catalog = [`msgstr "${rightToLeftMark}%(num)d ${zeroWidthSpace}"`];
  assert.ok(!ruleIds("locale/km/LC_MESSAGES/django.po", catalog).includes("hidden-unicode"));
  assert.ok(ruleIds("src/strings.ts", catalog).includes("hidden-unicode"));

  // Tag characters can spell out hidden instructions and are reported in translations too.
  const tags = [..."approve"].map((char) => String.fromCodePoint(0xe0000 + char.charCodeAt(0))).join("");
  assert.ok(ruleIds("locale/km/LC_MESSAGES/django.po", [`msgstr "ok${tags}"`]).includes("hidden-unicode"));
}

export function testMigrationOperationsCountOnlyAsCalls(): void {
  const framework = ["from .fields import AddField, AlterField, RemoveField, RenameField", "elif isinstance(operation, RemoveField):", "new CreateModel, and CreateModel and DeleteModel can be optimized into"];
  assert.ok(!ruleIds("django/db/migrations/operations/models.py", framework).includes("destructive-migration"));
  assert.ok(ruleIds("app/migrations/0002_remove_name.py", ["        migrations.RemoveField(", "            model_name='contenttype',"]).includes("destructive-migration"));
}

export function testActiveRecordLogNamesAreNotSql(): void {
  // The second argument of select_all is a name for the log, not SQL.
  assert.ok(!ruleIds("lib/active_record/querying.rb", ['connection.select_all(sanitize_sql(sql), "#{name} Load", binds)']).includes("sql-injection"));
  assert.ok(ruleIds("app/models/user.rb", ["User.where(\"email = '#{email}'\")"]).includes("sql-injection"));
}

export function testImportsDoNotTurnOffChecks(): void {
  assert.ok(!ruleIds("celery/backends/redis.py", ["from ssl import CERT_NONE, CERT_OPTIONAL, CERT_REQUIRED"]).includes("disabled-security-check"));
  assert.ok(ruleIds("app/client.py", ["context.verify_mode = ssl.CERT_NONE"]).includes("disabled-security-check"));
}

export function testTestDirectoriesAreTests(): void {
  // Django keeps tests in tests/ and tests.py, Mocha in test/, and RSpec helpers in spec/.
  const deserialize = ["self.assertEqual(qs.db, pickle.loads(pickle.dumps(qs)).db)"];
  assert.ok(!ruleIds("tests/multiple_database/tests.py", deserialize).includes("risky-api"));
  assert.ok(!ruleIds("tests/i18n/utils.py", deserialize).includes("risky-api"));
  assert.ok(!ruleIds("spec/support/fixtures.rb", ["Marshal.load(File.read(path))"]).includes("risky-api"));
  assert.ok(ruleIds("app/cache.py", ["value = pickle.loads(data)"]).includes("risky-api"));

  // Being test files, they are also where skip markers count.
  assert.ok(ruleIds("test/index.js", [`${["it", "skip"].join(".")}("parses dates", () => {});`]).includes("skipped-tests"));
}

export function testMigrationFrameworkCodeIsNotAMigration(): void {
  // Django's and Rails' migration code defines, generates, or names operations without running them.
  assert.ok(!ruleIds("django/db/migrations/operations/fields.py", ["class RemoveField(FieldOperation):"]).includes("destructive-migration"));
  assert.ok(!ruleIds("django/db/migrations/autodetector.py", ["                    operations.RemoveField("]).includes("destructive-migration"));
  assert.ok(!ruleIds("lib/active_record/migration/compatibility.rb", ["def rename_table(table_name, new_name, **options)"]).includes("destructive-migration"));
  assert.ok(!ruleIds("db/migrate/20261020_recorder.rb", [":create_table, :rename_table, :add_column, :remove_column,"]).includes("destructive-migration"));
  assert.ok(
    !ruleIds("db/migrate/20261020_guard.rb", ['raise ActiveRecord::IrreversibleMigration, "remove_column is only reversible if given a type."']).includes(
      "destructive-migration"
    )
  );
  // Django's own test migrations live under tests/.
  assert.ok(!ruleIds("tests/migrations/test_migrations/0002_second.py", ['        migrations.DeleteModel("Tribble"),']).includes("destructive-migration"));

  assert.ok(ruleIds("app/migrations/0002_second.py", ['        migrations.DeleteModel("Tribble"),']).includes("destructive-migration"));
  assert.ok(ruleIds("db/migrate/20261020_drop_legacy.rb", ["    remove_column :users, :legacy_id"]).includes("destructive-migration"));
  assert.ok(ruleIds("alembic/versions/ae1027a6acf_drop.py", ['    op.drop_table("legacy")']).includes("destructive-migration"));
}

export function testQuotedIdentifiersAreNotSqlInjection(): void {
  const quoted = [
    // A placeholder template, filled in by a later line.
    'field_sql = "%(field)s = VALUES(%(field)s)"',
    // Identifiers and values passed through the database's own quoting.
    'cursor.execute("SELECT * FROM %s LIMIT 1" % self.connection.ops.quote_name(table_name))',
    'sql = "ALTER TABLE %s RENAME TO %s" % (quote_name(old), quote_name(new))',
    "let query = `DELETE FROM ${this.quoteTable(tableName)}`;",
    "const emptyQuery = `INSERT INTO ${quotedTable} DEFAULT VALUES`;",
    'connection.execute("DELETE FROM #{quote_table_name(table)}")'
  ];
  for (const line of quoted) {
    assert.ok(!ruleIds("lib/db.py", [line]).includes("sql-injection"), line);
  }

  const built = [
    'cursor.execute("SELECT * FROM users WHERE name = %s" % name)',
    "let query = `DELETE FROM ${this.quoteTable(tableName)} WHERE id = ${id}`;",
    "const sql = `SELECT sql FROM sqlite_master WHERE tbl_name='${tableName}'`;",
    'connection.execute("DELETE FROM #{table}")',
    'query = "SELECT * FROM users WHERE id = " + quote_name(id) + suffix'
  ];
  for (const line of built) {
    assert.ok(ruleIds("lib/db.py", [line]).includes("sql-injection"), line);
  }
}
