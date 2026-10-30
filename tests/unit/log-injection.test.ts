import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { logInjectionRule } from "../../src/rules/log-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return logInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testLogInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth.js", ["logger.info(`Failed login for ${req.body.username}`);", "const { email } = req.body;", "console.log('Reset requested: ' + email);"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Request value written into a log line");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 write values from the request into the text of a log line, so a value with a line break in it can add fake entries, such as a forged login, to the log."
  );
}

export function testLogInjectionReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["app/auth.py", ["username = request.form['username']", "logger.warning(f'Failed login for {username}')"]],
    ["app/auth.py", ["logging.info('Search: %s', request.args.get('q'))"]],
    ["src/main/java/Auth.java", ['log.info("Failed login for {}", request.getParameter("user"));']],
    ["internal/auth.go", ['log.Printf("failed login for %s", r.FormValue("user"))']],
    ["app/controllers/sessions_controller.rb", ['Rails.logger.info "Failed login for #{params[:email]}"']],
    ["src/Auth.php", ["error_log('Failed login for ' . $_POST['user']);"]],
    ["Services/Auth.cs", ['_logger.LogWarning("Failed login for " + Request.Query["user"]);']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testLogInjectionSkipsCleanedAndStructuredValues(): void {
  const cases: Array<[string, string[]]> = [
    // Structured fields, whole objects, and cleaned or quoted values.
    ["src/auth.js", ["logger.info({ username: req.body.username }, 'failed login');"]],
    ["src/routes.js", ["console.log(req.query);"]],
    ["src/auth.js", ["logger.info(`Failed login for ${req.body.username.replace(/[\\r\\n]/g, '')}`);"]],
    ["src/auth.js", ["logger.info(`Search ${JSON.stringify(req.query.q)}`);"]],
    ["app/auth.py", ["logger.warning('Failed login for %r', request.form['username'])"]],
    ["app/auth.py", ["logger.warning(f'Failed login for {request.form[\"username\"]!r}')"]],
    ["internal/auth.go", ['log.Printf("failed login for %q", r.FormValue("user"))']],
    // Values that cannot hold a raw line break, results of calls, and names inside text.
    ["src/access.js", ["logger.info(`${req.method} ${req.url} ${req.headers['user-agent']}`);"]],
    ["src/items.js", ["logger.info(`Deleting item ${req.params.id}`);"]],
    ["app/auth.py", ["user = authenticate(request.form['username'])", "logger.info(f'Logged in {user}')"]],
    ["src/db.js", ["const name = req.body.database;", "console.error('That database name is invalid.');"]],
    ["src/auth.js", ["// logger.info(`x ${req.body.u}`)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testLogInjectionSkipsTestsAndOtherFiles(): void {
  const line = "logger.info(`x ${req.body.u}`);";

  assert.deepEqual(findings([added("src/auth.test.js", [line]), added("fixtures/auth.js", [line]), added("docs/auth.md", [line])]), []);
}

export function testLogInjectionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { logInjection: { enabled: false } } });

  assert.deepEqual(findings([added("src/auth.js", ["logger.info(`x ${req.body.u}`);"])], config), []);
}
