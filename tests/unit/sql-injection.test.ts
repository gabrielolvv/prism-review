import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testSqlInjectionRuleReportsSqlBuiltFromValues(): void {
  const findings = sqlFindings([
    file("app/repository.py", [
      'cursor.execute(f"SELECT * FROM users WHERE email = \'{email}\'")',
      'cursor.execute("DELETE FROM sessions WHERE user_id = %s" % user_id)',
      'db.execute("UPDATE users SET name = \'{}\' WHERE id = {}".format(name, user_id))',
      "cursor.execute(",
      '    f"SELECT id FROM orders WHERE status = \'{status}\'"',
      ")",
      'df = pd.read_sql(f"SELECT * FROM events WHERE day = \'{day}\'", conn)',
      'session.execute(text(f"DELETE FROM carts WHERE id = {cart_id}"))',
      'query = f"SELECT * FROM users WHERE name LIKE \'%{term}%\'"'
    ]),
    file("src/repository.ts", [
      "const rows = await pool.query(`SELECT * FROM users WHERE id = ${req.params.id}`);",
      "await knex.raw(\"SELECT * FROM orders WHERE customer = '\" + customer + \"'\");",
      "await prisma.$queryRawUnsafe(`DELETE FROM carts WHERE id = ${cartId}`);"
    ]),
    file("internal/store/users.go", ['\trows, err := db.QueryContext(ctx, fmt.Sprintf("SELECT * FROM users WHERE name = \'%s\'", name))']),
    file("src/main/java/UserDao.java", [
      '        ResultSet rs = stmt.executeQuery("SELECT * FROM users WHERE id = " + id);',
      '        String sql = "UPDATE users SET role = \'" + role + "\' WHERE id = " + id;'
    ]),
    file("src/Users.php", ['$result = $mysqli->query("SELECT * FROM users WHERE email = \'$email\'");']),
    file("src/Data/UserStore.cs", ['var users = context.Users.FromSqlRaw($"SELECT * FROM Users WHERE Name = \'{name}\'").ToList();']),
    file("app/models/user.rb", ['  User.where("email = \'#{params[:email]}\'")'])
  ]);

  const byFile = new Map(findings.map((finding) => [finding.file, finding]));
  assert.deepEqual([...byFile.keys()].sort(), [
    "app/models/user.rb",
    "app/repository.py",
    "internal/store/users.go",
    "src/Data/UserStore.cs",
    "src/Users.php",
    "src/main/java/UserDao.java",
    "src/repository.ts"
  ]);
  assert.ok(findings.every((finding) => finding.severity === "warning"));
  assert.equal(
    byFile.get("app/repository.py")?.message,
    "Lines 1, 2, 3, 5, 7 and 2 more build SQL from values inserted into the query text, which allows SQL injection unless every value is escaped."
  );
  assert.equal(
    byFile.get("internal/store/users.go")?.message,
    "Line 1 builds SQL from values inserted into the query text, which allows SQL injection unless every value is escaped."
  );
}

export function testSqlInjectionRuleIgnoresParameterizedQueries(): void {
  const findings = sqlFindings([
    file("app/repository.py", [
      'cursor.execute("SELECT * FROM users WHERE email = %s", (email,))',
      'cursor.execute("SELECT * FROM users WHERE email = %(email)s", {"email": email})',
      'logger.info(f"Running SELECT for {user_id}")',
      'query = f"Hello {name}, here is your SELECT list"'
    ]),
    file("src/repository.ts", [
      "const rows = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);",
      "const users = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;",
      "const message = `Updated ${count} rows`;",
      "exec(`git log ${ref}`);"
    ]),
    file("internal/store/users.go", ['\trows, err := db.QueryContext(ctx, "SELECT * FROM users WHERE name = $1", name)']),
    file("src/main/java/UserDao.java", ['        PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?");']),
    file("app/models/user.rb", ['  User.where("email = ?", params[:email])', "  User.where(email: params[:email])"]),
    file("docs/queries.md", ['cursor.execute(f"SELECT * FROM users WHERE id = {id}")']),
    file("tests/test_repository.py", ['cursor.execute(f"SELECT * FROM users WHERE id = {id}")'])
  ]);

  assert.deepEqual(findings, []);
}

export function testSqlInjectionRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { sqlInjection: { enabled: false } } });
  const files = [file("app/db.py", ['cursor.execute(f"SELECT * FROM t WHERE id = {x}")'])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "sql-injection"));
}

function sqlFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "sql-injection");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
