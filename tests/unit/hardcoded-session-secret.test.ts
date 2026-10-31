import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { hardcodedSessionSecretRule } from "../../src/rules/hardcoded-session-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return hardcodedSessionSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Assembled at runtime so this file does not trip the rule it tests.
const key = ["s3cr3t", "-session", "-key"].join("");

export function testHardcodedSessionSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/app.js", [
      "app.use(session({",
      "  cookie: { secure: true, httpOnly: true },",
      `  secret: '${key}',`,
      "  resave: false",
      "}));",
      `app.use(cookieParser('${key}'));`
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Session key written in the code");
  assert.deepEqual(finding?.lines, [3, 6]);
  assert.equal(
    finding?.message,
    "Lines 3, 6 set the key that signs session cookies to text written in the code, so anyone who can read the code can make a cookie for any user. With Flask, Django, and Rails, which unpickle or unmarshal some signed data, that can also mean running code on the server."
  );
}

export function testHardcodedSessionSecretReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["app/__init__.py", [`app.secret_key = "${key}"`]],
    ["app/__init__.py", [`app.config["SECRET_KEY"] = "${key}"`]],
    ["mysite/settings.py", [`SECRET_KEY = 'django-insecure-${key}'`]],
    ["app/__init__.py", [`app.config.update(SECRET_KEY="${key}", DEBUG=False)`]],
    ["config/initializers/secret_token.rb", [`Rails.application.config.secret_key_base = "${key}"`]],
    ["config/secrets.yml", ["production:", `  secret_key_base: ${JSON.stringify(key)}`]],
    ["app.rb", [`set :session_secret, "${key}"`]],
    ["config/prod.exs", ["config :app, AppWeb.Endpoint,", `  secret_key_base: "${key}"`]],
    ["src/server.ts", [`app.keys = ['${key}'];`]],
    ["src/session.ts", ["export const sessionOptions = {", "  cookieName: 'app',", `  password: '${key}',`, "};"]],
    ["main.go", [`store := sessions.NewCookieStore([]byte("${key}"))`]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testHardcodedSessionSecretSkipsKeysFromElsewhere(): void {
  const cases: Array<[string, string[]]> = [
    // Keys read from the environment or a secret store, including with a fallback.
    ["src/app.js", ["app.use(session({ secret: process.env.SESSION_SECRET, resave: false }));"]],
    ["app/__init__.py", ['app.secret_key = os.environ["SECRET_KEY"]']],
    ["mysite/settings.py", ['SECRET_KEY = os.environ.get("SECRET_KEY", get_random_secret_key())']],
    ["config/secrets.yml", ["production:", '  secret_key_base: <%= ENV["SECRET_KEY_BASE"] %>']],
    // Templates, empty defaults, documentation inside docstrings, and messages that mention a call.
    ["project_template/settings.py", ["SECRET_KEY = '{{ secret_key }}'"]],
    ["django/conf/global_settings.py", ["SECRET_KEY = ''"]],
    ["flask/config.py", ['    """', "    SECRET_KEY = 'development key'", '    """']],
    ["lib/response.js", ["throw new Error('cookieParser(\"secret\") required for signed cookies');"]],
    // Other options named secret, outside session middleware.
    ["src/client.js", [`const client = new Client({ secret: '${key}' });`]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testHardcodedSessionSecretSkipsSamplesAndCanBeDisabled(): void {
  const line = `app.secret_key = "${key}"`;
  assert.deepEqual(findings([added("tests/conftest.py", [line]), added("examples/app.py", [line]), added("docs/quickstart.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { hardcodedSessionSecret: { enabled: false } } });
  assert.deepEqual(findings([added("app/__init__.py", [line])], config), []);
}

export function testHardcodedSessionSecretSeesLinesRedactionRewrites(): void {
  // Redaction rewrites `secret: '...'` and `SECRET_KEY = '...'`, so the lines are found before it.
  const files = prepareChangedFiles([added("mysite/settings.py", [`SECRET_KEY = '${key}'`])], defaultConfig);

  assert.doesNotMatch(files[0]?.patch ?? "", new RegExp(key));
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "hardcoded-session-secret").map((finding) => finding.line),
    [1]
  );
}
