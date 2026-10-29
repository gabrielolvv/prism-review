import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { secretLoggingRule } from "../../src/rules/secret-logging.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return secretLoggingRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSecretLoggingReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth/login.ts", [
      "logger.info('login attempt', { email, password });",
      'console.log("Invalid password for", email);',
      "console.debug(`Authorization: Bearer ${accessToken}`);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Secret written to a log");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 write what looks like a password, token, or key to a log or the console, where anyone who can read the logs, or a log service, can see it."
  );
}

export function testSecretLoggingReadsEachLanguage(): void {
  const cases: Array<[string, string]> = [
    ["src/server.js", "console.log(req.headers.authorization);"],
    ["src/config.ts", "log.debug('config', process.env.STRIPE_API_KEY);"],
    ["app/auth.py", 'logging.info("user %s logged in with %s", user.email, user.password)'],
    ["app/auth.py", 'logger.debug(f"refresh token: {refresh_token}")'],
    ["app/services/auth.rb", 'Rails.logger.info "token=#{session_token}"'],
    ["internal/auth/login.go", 'log.Printf("login %s %s", username, password)'],
    ["src/main/java/Auth.java", 'LOGGER.info("client secret {}", clientSecret);'],
    ["src/main/java/Auth.java", "System.out.println(apiKey);"],
    ["Services/AuthService.cs", '_logger.LogInformation("Token {Token}", user.Token);'],
    ["src/Auth.php", "error_log('password: ' . $password);"],
    ["src/Auth.php", "Log::info('key', ['api_key' => $apiKey]);"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testSecretLoggingSkipsDescriptionsOfSecrets(): void {
  const safe = [
    // Text only, and names about a secret rather than the secret.
    'logger.warn("Invalid password");',
    'console.log("Token expired for", user.id);',
    "logger.info('password length', password.length);",
    "logger.debug({ tokenType, expiresIn });",
    "console.log(hasToken, secretName, passwordPolicy);",
    "logger.info('last digits', apiKey.slice(-4));",
    "logger.info('tokens', tokens.length, tokenizer.name);",
    // What a token says about its holder, as Spring Security logs it.
    'this.log.debug("Cannot logout principal: " + token.getPrincipal());',
    // Not a log call.
    "const header = `Bearer ${token}`;",
    "fetch(url, { headers: { Authorization: `Bearer ${token}` } });",
    // Comments.
    "// console.log(password);"
  ];

  assert.deepEqual(findings([added("src/auth.ts", safe)]), []);
}

export function testSecretLoggingSkipsTestsDocsAndOtherFiles(): void {
  const line = "console.log(password);";

  assert.deepEqual(
    findings([
      added("src/auth.test.ts", [line]),
      added("docs/auth.md", [line]),
      added("fixtures/app/auth.js", [line]),
      added("config/app.yml", [line]),
      added("dist/source/core/options.d.ts", [line])
    ]),
    []
  );
}

export function testSecretLoggingCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { secretLogging: { enabled: false } } });

  assert.deepEqual(findings([added("src/auth.ts", ["console.log(password);"])], config), []);
}

export function testSecretLoggingSeesLinesRedactionRewrites(): void {
  // Redaction rewrites `token={refresh_token}` because of the word before the equals sign, so the
  // lines are found before it runs.
  const files = prepareChangedFiles([added("app/auth.py", ['logger.debug(f"token={refresh_token}")'])], defaultConfig);

  assert.ok(!(files[0]?.patch ?? "").includes("{refresh_token}"));
  assert.deepEqual(findings(files)[0]?.lines, [1]);
}
