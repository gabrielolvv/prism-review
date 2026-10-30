import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { timingUnsafeComparisonRule } from "../../src/rules/timing-unsafe-comparison.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return timingUnsafeComparisonRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testTimingUnsafeComparisonReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/webhook.ts", [
      "const expected = sign(body);",
      "if (signature !== expected) return res.status(401).end();",
      "if (req.headers['x-api-key'] !== process.env.API_KEY) return res.sendStatus(401);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Secret compared in variable time");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 compare what looks like a signature, token, or key with an operator that stops at the first difference, so how long the check takes can reveal the expected value one character at a time."
  );
}

export function testTimingUnsafeComparisonReadsEachLanguage(): void {
  const cases: Array<[string, string]> = [
    ["src/webhook.ts", "if (req.headers['x-hub-signature-256'] !== `sha256=${digest}`) throw new Error();"],
    ["src/auth.js", "if (user.resetToken !== req.body.resetToken) throw new Forbidden();"],
    ["app/views.py", "if request.headers.get('X-Token') != settings.API_TOKEN:"],
    ["app/views.py", "if hmac.new(key, body, sha256).hexdigest() == signature:"],
    ["app/controllers/hooks_controller.rb", "head :unauthorized unless params[:token] == ENV['WEBHOOK_SECRET']"],
    ["internal/auth.go", 'if r.Header.Get("X-Api-Key") != apiKey {'],
    ["internal/auth.go", "if !bytes.Equal(mac, expectedSignature) {"],
    ["src/main/java/Auth.java", "if (!presentedToken.equals(storedToken)) {"],
    ["src/Auth.php", "if ($request->header('X-Signature') == $signature) {"],
    ["Services/Auth.cs", "if (apiKey != _options.ApiKey) return Unauthorized();"],
    ["src/debug.py", "elif cmd == 'pinauth' and secret == self.secret:"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testTimingUnsafeComparisonSkipsOtherComparisons(): void {
  const cases: Array<[string, string]> = [
    // Constant-time comparisons.
    ["src/webhook.ts", "if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {"],
    ["app/views.py", "if not hmac.compare_digest(signature, expected):"],
    // Checks of whether a token is there, or of something about it.
    ["src/auth.js", "if (token === undefined || token === null) return;"],
    ["src/auth.js", "if (token.length !== 64) return;"],
    ["src/auth.js", "if (typeof token !== 'string') return;"],
    ["src/auth.js", "if (tokenType !== 'Bearer') return;"],
    ["src/auth.py", "if len(token) != TOKEN_LENGTH:"],
    // Tokens that are not secret: lexers, pages, and OpenID nonces.
    ["src/tokens.ts", "if (token.type === TokenType.String) {"],
    ["src/stream.ts", "if (nextToken === prevToken) {"],
    ["src/api.ts", "if (pageToken !== nextPageToken) {"],
    ["src/Model.java", "if (t == JsonToken.START_OBJECT) {"],
    ["src/auth.py", "if payload['nonce'] != expected_nonce:"],
    // equals methods, comments, and reviewed lines.
    ["src/Model.java", "return Objects.equals(this.token, that.token);"],
    ["src/model.py", "return self.token == other.token"],
    ["src/auth.js", "// if (signature !== expected)"],
    ["app/views.py", "if token == expected:  # nosec"]
  ];
  for (const [path, line] of cases) {
    assert.deepEqual(findings([added(path, [line])]), [], `${path}: ${line}`);
  }
}

export function testTimingUnsafeComparisonSkipsTestsAndLanguageTooling(): void {
  const line = "if (signature !== expected) return;";

  assert.deepEqual(
    findings([
      added("src/webhook.test.ts", [line]),
      added("fixtures/webhook.ts", [line]),
      added("src/parser/expression.ts", [line]),
      added("src/lexer.ts", [line]),
      added("docs/webhook.md", [line])
    ]),
    []
  );
}

export function testTimingUnsafeComparisonCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { timingUnsafeComparison: { enabled: false } } });

  assert.deepEqual(findings([added("src/webhook.ts", ["if (signature !== expected) return;"])], config), []);
}

export function testTimingUnsafeComparisonSeesLinesRedactionRewrites(): void {
  // Redaction rewrites `token == expected_token` because of the word before the equals sign.
  const files = prepareChangedFiles([added("app/views.py", ["if token == expected_token:"])], defaultConfig);

  assert.ok(!(files[0]?.patch ?? "").includes("token == expected_token"));
  assert.deepEqual(findings(files)[0]?.lines, [1]);
}
