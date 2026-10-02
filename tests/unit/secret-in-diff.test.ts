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
const awsKeyId = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
const privateKeyHeader = ["-----BEGIN OPENSSH PRIVATE", "KEY-----"].join(" ");

export function testFindAddedSecretsNumbersLinesInTheNewFile(): void {
  const patch = [
    "@@ -10,4 +10,5 @@ export const config = {",
    " const a = 1;",
    `-const old = "${githubToken}";`,
    "+const replaced = process.env.TOKEN;",
    ` const kept = "${awsKeyId}";`,
    `+const added = "${awsKeyId}";`,
    "\\ No newline at end of file",
    "@@ -40,2 +41,3 @@",
    " context();",
    `+${privateKeyHeader}`,
    `+headers.Authorization = "token ${githubToken}";`
  ].join("\n");

  assert.deepEqual(findAddedSecrets(patch), [
    { line: 13, kind: "AWS access key ID" },
    { line: 42, kind: "private key" },
    { line: 43, kind: "GitHub token" }
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

  assert.deepEqual(findAddedSecrets(patch, [/EXAMPLE$/]), []);
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
  assert.doesNotMatch(markdown, /sk-thisShouldNeverAppear/);
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

function changedFile(path: string, patch: string): ChangedFile {
  return { path, status: "added", additions: patch.split("\n").length - 1, deletions: 0, patch };
}
