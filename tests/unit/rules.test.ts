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
    "AUTHORS",
    "src/controllers/user.ts",
    "src/tokenizer.ts",
    "src/console.ts",
    "docs/repayments-faq.md",
    "src/parole.ts"
  ];
  const config = prismConfigSchema.parse({ rules: { sensitiveFiles: { patterns: [] } } });

  const result = analyzePullRequest([...flagged, ...ignored].map(changedFile), config);
  const sensitive = result.findings
    .filter((finding) => finding.ruleId === "sensitive-files")
    .map((finding) => finding.file);

  assert.deepEqual(sensitive, flagged);
}

function changedFile(path: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 0 };
}
