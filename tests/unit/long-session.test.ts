import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { longSessionRule } from "../../src/rules/long-session.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return longSessionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testLongSessionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth.js", [
      "const jwt = require('jsonwebtoken');",
      "const accessToken = jwt.sign({ sub: user.id }, secret, { expiresIn: '365d' });",
      "app.use(session({ secret, cookie: { maxAge: 1000 * 60 * 60 * 24 * 365 } }));"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Session lasts too long");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 give sessions or access tokens a lifetime longer than 30 days, so one that is stolen, from a log, a shared computer, or a cross-site scripting bug, keeps working that long, and a JSON Web Token cannot be revoked before it expires."
  );
}

export function testLongSessionReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/auth.ts", ["import jwt from 'jsonwebtoken';", "return jwt.sign(payload, key, { expiresIn: 60 * 60 * 24 * 90 });"]],
    ["src/auth.ts", ["const jwt = await new SignJWT(claims).setExpirationTime('1y').sign(key);"]],
    ["src/pages/api/auth/[...nextauth].ts", ["export const authOptions: AuthOptions = {", "  session: { strategy: 'jwt', maxAge: 365 * 24 * 60 * 60 },", "};"]],
    ["project/settings.py", ["SESSION_COOKIE_AGE = 60 * 60 * 24 * 365"]],
    ["project/settings.py", ["SIMPLE_JWT = {", "    'ACCESS_TOKEN_LIFETIME': timedelta(days=90),", "}"]],
    ["app/config.py", ["JWT_ACCESS_TOKEN_EXPIRES = timedelta(weeks=52)"]],
    ["app/auth.py", ["token = jwt.encode({'sub': user.id, 'exp': datetime.utcnow() + timedelta(days=365)}, key)"]],
    ["config/initializers/session_store.rb", ["Rails.application.config.session_store :cookie_store, key: '_app_session', expire_after: 1.year"]],
    ["config/initializers/devise.rb", ["  config.timeout_in = 6.months"]],
    ["auth/token.go", ["\t\tExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * 365 * time.Hour)),"]],
    ["src/main/java/app/Tokens.java", ["    .setExpiration(new Date(System.currentTimeMillis() + 1000L * 60 * 60 * 24 * 365))"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testLongSessionSkipsShortAndLongByDesign(): void {
  const cases: Array<[string, string[]]> = [
    // 30 days or less, in each unit.
    ["src/auth.js", ["const jwt = require('jsonwebtoken');", "jwt.sign(payload, key, { expiresIn: '15m' });", "jwt.sign(payload, key, { expiresIn: 60 * 60 * 24 * 30 });"]],
    ["src/app.js", ["app.use(session({ cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } }));"]],
    // next-auth's maxAge is in seconds: 30 days is its default.
    ["src/auth.ts", ["export const authOptions: AuthOptions = { session: { maxAge: 30 * 24 * 60 * 60 } };"]],
    ["project/settings.py", ["SESSION_COOKIE_AGE = 60 * 60 * 24 * 14", "SIMPLE_JWT = {'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15)}"]],
    ["config/initializers/devise.rb", ["  config.timeout_in = 30.minutes"]],
    // Refresh and "remember me" tokens last longer by design.
    ["src/auth.js", ["const jwt = require('jsonwebtoken');", "const refreshToken = jwt.sign(payload, key, { expiresIn: '90d' });"]],
    ["project/settings.py", ["SIMPLE_JWT = {", "    'REFRESH_TOKEN_LIFETIME': timedelta(days=90),", "}"]],
    ["src/app.js", ["if (req.body.rememberMe) {", "  req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 365;", "}", "app.use(session({}));"]],
    // expiresIn outside a JWT, such as a presigned URL, and a lifetime read from configuration.
    ["src/upload.js", ["const url = await getSignedUrl(s3, command, { expiresIn: 60 * 60 * 24 * 365 });"]],
    ["src/auth.js", ["const jwt = require('jsonwebtoken');", "jwt.sign(payload, key, { expiresIn: config.tokenLifetime });"]],
    ["src/auth.js", ["const jwt = require('jsonwebtoken');", "// jwt.sign(payload, key, { expiresIn: '365d' });"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testLongSessionSkipsTestsAndCanBeDisabled(): void {
  const lines = ["const jwt = require('jsonwebtoken');", "jwt.sign(payload, key, { expiresIn: '365d' });"];
  assert.deepEqual(findings([added("src/auth.test.js", lines), added("fixtures/auth.js", lines), added("examples/auth.js", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { longSession: { enabled: false } } });
  assert.deepEqual(findings([added("src/auth.js", lines)], config), []);
}

export function testLongSessionSeesLinesRedactionRewrites(): void {
  // Redaction removes `jwt.sign({` from `const token = jwt.sign(...)` because of the name, and with
  // it what shows the line signs a JWT, so lifetimes are found before it.
  const files = prepareChangedFiles([added("src/auth.js", ["const token = jwt.sign({ sub }, key, { expiresIn: '1y' });"])], defaultConfig);

  assert.doesNotMatch(files[0]?.patch ?? "", /jwt\.sign/);
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "long-session").map((finding) => finding.line),
    [1]
  );
}
