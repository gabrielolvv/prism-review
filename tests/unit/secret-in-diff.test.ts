import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { renderAnnotations } from "../../src/reporting/render-annotations.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";
import { findAddedSecrets } from "../../src/security/detect-secrets.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

// Assembled at runtime so this file does not trip secret scanners, Prism Review included.
const githubToken = `ghp_${"a1B2".repeat(9)}`;
const awsKeyId = ["AKIA", "Q7WZ3NXR5TPL2MVB"].join("");
const privateKeyHeader = ["-----BEGIN OPENSSH PRIVATE", "KEY-----"].join(" ");
const pgpKeyHeader = ["-----BEGIN PGP PRIVATE", "KEY BLOCK-----"].join(" ");
// The base64 that follows a key header; a header without it is not a key.
const keyMaterial = "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW";

export function testFindAddedSecretsNumbersLinesInTheNewFile(): void {
  const patch = [
    "@@ -10,4 +10,5 @@ export const config = {",
    " const a = 1;",
    `-const old = "${githubToken}";`,
    "+const replaced = process.env.TOKEN;",
    ` const kept = "${awsKeyId}";`,
    `+const added = "${awsKeyId}";`,
    "\\ No newline at end of file",
    "@@ -40,2 +41,4 @@",
    " context();",
    `+${privateKeyHeader}`,
    `+${keyMaterial}`,
    `+headers.Authorization = "token ${githubToken}";`
  ].join("\n");

  assert.deepEqual(findAddedSecrets(patch), [
    { line: 13, kind: "AWS access key ID" },
    { line: 42, kind: "private key" },
    { line: 44, kind: "GitHub token" }
  ]);
}

export function testFindAddedSecretsSkipsGitHeaders(): void {
  const patch = [
    "diff --git a/token.txt b/token.txt",
    "--- a/token.txt",
    `+++ b/${githubToken}`,
    "@@ -0,0 +1 @@",
    "+no secrets here"
  ].join("\n");

  assert.deepEqual(findAddedSecrets(patch), []);
}

export function testFindAddedSecretsHonorsAllowlist(): void {
  const patch = `@@ -1 +1,2 @@\n context\n+aws_access_key_id = ${awsKeyId}`;

  assert.deepEqual(findAddedSecrets(patch, [/MVB$/]), []);
  assert.deepEqual(findAddedSecrets(patch, [/^nothing$/]), [{ line: 2, kind: "AWS access key ID" }]);
}

export function testFindAddedSecretsIgnoresGenericTokens(): void {
  // Lockfile integrity hashes and commit SHAs are redacted, but they are not credentials.
  const patch = [
    "@@ -1,2 +1,3 @@",
    ' "lodash": {',
    `+  "integrity": "sha512-${"Ab3+".repeat(22)}==",`,
    `+  "resolved": "${"0123456789abcdef".repeat(2)}01234567"`
  ].join("\n");

  assert.deepEqual(findAddedSecrets(patch), []);
}

export function testSecretInDiffRuleReportsFixtureLeak(): void {
  const files = prepareChangedFiles(loadDiffFixture("fixtures/diffs/secret-leak.diff"), defaultConfig);

  const result = analyzePullRequest(files, defaultConfig);
  const finding = result.findings.find((candidate) => candidate.ruleId === "secret-in-diff");

  assert.equal(result.riskLevel, "high");
  assert.deepEqual(finding, {
    ruleId: "secret-in-diff",
    title: "Possible secret added",
    severity: "high",
    file: "src/config/env.ts",
    line: 2,
    message:
      "Line 2 adds what looks like an OpenAI-style API key. The value is redacted from this review.",
    recommendation:
      "Treat the credential as exposed: revoke or rotate it, remove it from the branch history, and load it from a secret store. If it is a known test value, add a pattern for it to security.redaction.allowlist."
  });
  assert.equal(result.findings[0], finding);

  const markdown = renderMarkdown(result);
  assert.match(markdown, /^File: `src\/config\/env\.ts`, line 2$/m);
  assert.doesNotMatch(markdown, /thisShouldNeverAppear/);
  assert.match(renderAnnotations(result)[0] ?? "", /^::error file=src\/config\/env\.ts,line=2,/);
}

export function testSecretInDiffRuleSummarizesManyLines(): void {
  const patch = [
    "@@ -0,0 +1,8 @@",
    ...Array.from({ length: 7 }, (_, index) => `+TOKEN_${index}=${githubToken}`),
    `+AWS_KEY=${awsKeyId}`
  ].join("\n");
  const files = prepareChangedFiles([changedFile("deploy/.env", patch)], defaultConfig);

  const [finding] = analyzePullRequest(files, defaultConfig).findings;

  assert.equal(finding?.line, 1);
  assert.equal(
    finding?.message,
    "Lines 1, 2, 3, 4, 5 and 3 more add values that look like credentials (GitHub token, AWS access key ID). The values are redacted from this review."
  );
}

export function testSecretInDiffRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { secretInDiff: { enabled: false } } });
  const files = prepareChangedFiles(loadDiffFixture("fixtures/diffs/secret-leak.diff"), config);

  const result = analyzePullRequest(files, config);

  assert.ok(!result.findings.some((finding) => finding.ruleId === "secret-in-diff"));
}

export function testFindAddedSecretsDetectsPgpPrivateKeys(): void {
  // PGP armor puts headers such as Version and a blank line before the key.
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1,4 @@\n+${pgpKeyHeader}\n+Version: GnuPG v2\n+\n+${keyMaterial}`), [
    { line: 1, kind: "private key" }
  ]);
}

export function testFindAddedSecretsNeedsKeyMaterialAfterAHeader(): void {
  // TLS libraries such as Netty and Tomcat keep the header as a constant to write keys with.
  const constants = [
    "@@ -0,0 +1,3 @@",
    `+private static final String BEGIN_KEY = "${privateKeyHeader}\\n";`,
    '+private static final String END_KEY = "\\n-----END PRIVATE KEY-----";',
    "+keyText = BEGIN_KEY + Base64.encode(key.getEncoded()) + END_KEY;"
  ].join("\n");
  assert.deepEqual(findAddedSecrets(constants), []);

  // A key in one string, and a key whose material comes a few lines later, as in encrypted PEM files.
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1 @@\n+KEY = "${privateKeyHeader}\\n${keyMaterial}\\n"`), [{ line: 1, kind: "private key" }]);
  const encrypted = ["@@ -0,0 +1,5 @@", `+${privateKeyHeader}`, "+Proc-Type: 4,ENCRYPTED", "+DEK-Info: AES-128-CBC,0123ABCD", "+", `+${keyMaterial}`].join("\n");
  assert.deepEqual(findAddedSecrets(encrypted), [{ line: 1, kind: "private key" }]);
}

export function testFindAddedSecretsReadsKeysOnOneLine(): void {
  // A service account's JSON keeps the whole key, END line included, in one string.
  const endLine = ["-----END OPENSSH PRIVATE", "KEY-----"].join(" ");
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1 @@\n+  "private_key": "${privateKeyHeader}\\n${keyMaterial}\\n${endLine}\\n",`), [
    { line: 1, kind: "private key" }
  ]);
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1,2 @@\n+const KEY = "${privateKeyHeader}\\n" +\n+  "${keyMaterial}";`), [{ line: 1, kind: "private key" }]);

  // A minified bundle that checks for the header has long names and base64 alphabets later on the line.
  const bundle = `@@ -0,0 +1 @@\n+if(0!==e.indexOf("${privateKeyHeader}"))throw new TypeError("pkcs8");var ${"Ab".repeat(30)}=1;`;
  assert.deepEqual(findAddedSecrets(bundle), []);
}

export function testSecretInDiffRuleSkipsSampleKeys(): void {
  const key = `@@ -0,0 +1,2 @@\n+${privateKeyHeader}\n+${keyMaterial}`;
  const token = `@@ -0,0 +1 @@\n+GH_TOKEN=${githubToken}`;
  const reported = (path: string, patch: string) =>
    analyzePullRequest(prepareChangedFiles([changedFile(path, patch)], defaultConfig), defaultConfig).findings.some(
      (finding) => finding.ruleId === "secret-in-diff"
    );

  // Tests, examples, and documentation use throwaway keys to show TLS and signing.
  for (const path of [
    "tests/certs/server.key",
    "test-fixtures/keys/key.pem",
    "_fixture/certs/key.pem",
    "examples/ssl/worker.key",
    "demos/user_rsa_key",
    "docs/usage.rst",
    "README.md",
    "src/auth/signer.test.ts"
  ]) {
    assert.equal(reported(path, key), false, path);
  }
  // A key anywhere else, and a token anywhere, is still reported.
  assert.equal(reported("deploy/server.key", key), true);
  assert.equal(reported("src/main/java/SslUtils.java", key), true);
  assert.equal(reported("tests/ci.env", token), true);
  assert.equal(reported("docs/setup.md", token), true);
}

export function testFindAddedSecretsSkipsTheDocumentedAwsExample(): void {
  // AWS's documentation and SDK tests use this key ID; a real one is still reported.
  const documented = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1 @@\n+accessKeyID := "${documented}"`), []);
  assert.deepEqual(findAddedSecrets(`@@ -0,0 +1 @@\n+accessKeyID := "${awsKeyId}"`), [{ line: 1, kind: "AWS access key ID" }]);
}

export function testSecretInDiffRuleScansOversizedPatches(): void {
  const config = prismConfigSchema.parse({ security: { maxPatchBytes: 1000 } });
  const patch = [
    `@@ -0,0 +1,3 @@`,
    `+${"a".repeat(2000)}`,
    `+const vendorKey = "${awsKeyId}";`,
    "+export {};"
  ].join("\n");
  const files = prepareChangedFiles([changedFile("vendor/sdk.min.js", patch)], config);

  const result = analyzePullRequest(files, config);

  assert.equal(files[0]?.patch, undefined);
  assert.deepEqual(
    result.findings.map((finding) => [finding.ruleId, finding.line]),
    [
      ["secret-in-diff", 2],
      ["oversized-patch", undefined]
    ]
  );
  assert.doesNotMatch(renderMarkdown(result, { includeLowSeverity: true }), new RegExp(awsKeyId));
}

export function testSecretInDiffRuleScansUnpreparedFiles(): void {
  const files = [changedFile("deploy/ci.sh", `@@ -0,0 +1 @@\n+export GH_TOKEN=${githubToken}`)];

  const [finding] = analyzePullRequest(files, defaultConfig).findings;

  assert.equal(finding?.ruleId, "secret-in-diff");
  assert.equal(finding?.line, 1);
}

export function testFindAddedSecretsStaysLinearOnHostileInput(): void {
  // Several megabytes of near-misses; a backtracking pattern would take minutes here.
  const lines = [
    `+ ${"sk-".repeat(200_000)}-`,
    `+ ghp_${"a".repeat(1_000_000)}-`,
    `+-----BEGIN ${"A ".repeat(500_000)}PUBLIC KEY-----`,
    `+${privateKeyHeader}${"+".repeat(1_000_000)}-`,
    `+ ${"AKIA".repeat(250_000)}`
  ];
  const started = performance.now();

  findAddedSecrets(`@@ -0,0 +1,5 @@\n${lines.join("\n")}`);

  assert.ok(performance.now() - started < 2000, `took ${Math.round(performance.now() - started)}ms`);
}

function changedFile(path: string, patch: string): ChangedFile {
  return { path, status: "added", additions: patch.split("\n").length - 1, deletions: 0, patch };
}
