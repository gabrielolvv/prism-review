import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import { defaultConfig } from "../../src/config/schema.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testDefaultRules(): void {
  const files = loadDiffFixture("fixtures/diffs/risky-auth-change.diff");

  const result = analyzePullRequest(files, defaultConfig);

  assert.equal(result.riskLevel, "high");
  const ruleIds = result.findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("sensitive-files"));
  assert.ok(ruleIds.includes("missing-tests"));
}
