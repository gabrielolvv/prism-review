import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testDefaultRules(): void {
  const files = loadDiffFixture("fixtures/diffs/risky-auth-change.diff");

  const result = analyzePullRequest(files, defaultConfig);

  assert.equal(result.riskLevel, "high");
  const ruleIds = result.findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("sensitive-files"));
  assert.ok(ruleIds.includes("missing-tests"));
}

export function testDependencyRiskRule(): void {
  const files = loadDiffFixture("fixtures/diffs/dependency-change.diff");

  const result = analyzePullRequest(files, defaultConfig);
  const dependencyFindings = result.findings.filter(
    (finding) => finding.ruleId === "dependency-risk"
  );

  assert.equal(dependencyFindings.length, 2);
  assert.ok(dependencyFindings.every((finding) => finding.severity === "warning"));
}

export function testSensitiveFilesRuleMatchesKeywordsAsWords(): void {
  const flagged = [
    "src/auth/session.ts",
    "src/authenticate.ts",
    "src/middleware/authorize.ts",
    "src/oauth2/callback.ts",
    "src/oauthClient.ts",
    "src/AuthProvider.tsx",
    "src/errors/Unauthorized.ts",
    "src/reauth.ts",
    "src/preauthorize.ts",
    "pkg/jwtauth/middleware.go",
    "src/authtoken.ts",
    "src/accesstoken.ts",
    "src/sessionid.ts",
    "src/sessions2.ts",
    "infra/secretsmanager.tf",
    "src/security/redact-secrets.ts",
    "config/secrets.yml",
    "db/migrations/001_users.sql",
    "src/user_roles.ts",
    "src/jwtVerify.ts",
    "src/PaymentIntent.ts",
    "services/billing-service/index.ts",
    "src/accessTokens.ts",
    "Dockerfile",
    "deploy/Dockerfile.prod"
  ];
  const ignored = [
    "docs/rule-authoring.md",
    "src/author.ts",
    "src/coauthors.ts",
    "AUTHORS",
    "src/controllers/user.ts",
    "src/tokenizer.ts",
    "src/tokenize.ts",
    "src/console.ts",
    "src/parole.ts",
    "docs/secretary.md",
    // Documentation, tests, and fixtures only describe a sensitive area.
    "docs/repayments-faq.md",
    "tests/unit/workflow-risk.test.ts",
    "src/auth/session.test.ts",
    "test/fixtures/secrets.yml"
  ];
  const config = prismConfigSchema.parse({ rules: { sensitiveFiles: { patterns: [] } } });

  const result = analyzePullRequest([...flagged, ...ignored].map(changedFile), config);
  const sensitive = result.findings
    .filter((finding) => finding.ruleId === "sensitive-files")
    .map((finding) => finding.file ?? "");

  assert.deepEqual([...sensitive].sort(), [...flagged].sort());
  // A word in the path is a warning; a configured pattern is high.
  assert.ok(result.findings.filter((finding) => finding.ruleId === "sensitive-files").every((finding) => finding.severity === "warning"));
}

export function testSensitiveFilePatternsStayHighForEveryFile(): void {
  const result = analyzePullRequest(["src/auth/login.ts", "tests/auth/login.test.ts", "src/billing/charge.ts"].map(changedFile), defaultConfig);
  const severities = Object.fromEntries(
    result.findings.filter((finding) => finding.ruleId === "sensitive-files").map((finding) => [finding.file, finding.severity])
  );

  // `**/auth/**` is a default pattern, so even a test under it is high; billing only matches a word.
  assert.deepEqual(severities, { "src/auth/login.ts": "high", "tests/auth/login.test.ts": "high", "src/billing/charge.ts": "warning" });
}

function changedFile(path: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 0 };
}

export function testPatternsWithoutASlashMatchAtAnyDepth(): void {
  // As in .gitignore, `package.json` means a package.json in any directory, so monorepos are covered.
  const config = prismConfigSchema.parse({ rules: { sensitiveFiles: { patterns: ["*.tf", "infra/**"] } } });
  const files: ChangedFile[] = [
    "package.json",
    "packages/ui/package.json",
    "services/api/requirements.txt",
    "crates/core/Cargo.lock",
    "modules/network/main.tf",
    "docs/package.json.md"
  ].map((path) => ({ path, status: "modified", additions: 1, deletions: 0 }));

  const flagged = (ruleId: string) =>
    analyzePullRequest(files, config)
      .findings.filter((finding) => finding.ruleId === ruleId)
      .map((finding) => finding.file);

  assert.deepEqual(flagged("dependency-risk"), [
    "package.json",
    "packages/ui/package.json",
    "services/api/requirements.txt",
    "crates/core/Cargo.lock"
  ]);
  assert.deepEqual(flagged("sensitive-files"), ["modules/network/main.tf"]);
}
