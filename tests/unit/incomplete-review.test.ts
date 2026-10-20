import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

const files = docs(3000);

export function testIncompleteReviewRuleReportsMissingFiles(): void {
  const result = analyzePullRequest(files, defaultConfig, { expectedFileCount: 3500 });
  const finding = result.findings.find((candidate) => candidate.ruleId === "incomplete-review");

  assert.equal(finding?.severity, "high");
  assert.equal(
    finding?.message,
    "This pull request changes 3500 files, but GitHub returned 3000, so 500 files were not reviewed."
  );
  assert.equal(result.riskLevel, "high");
}

export function testIncompleteReviewRuleIsQuietWhenEveryFileArrived(): void {
  const ignoring = prismConfigSchema.parse({ ignorePaths: ["docs/**"] });

  for (const [config, expectedFileCount] of [
    [defaultConfig, 3000],
    [defaultConfig, undefined],
    // Ignored files still arrived, so they do not count as missing.
    [ignoring, 3000]
  ] as const) {
    const result = analyzePullRequest(files, config, { expectedFileCount });
    assert.ok(!result.findings.some((finding) => finding.ruleId === "incomplete-review"), String(expectedFileCount));
  }
}

export function testIncompleteReviewRuleIgnoresAStaleCountBelowGitHubsLimit(): void {
  // A push between the event and the API call can lower the count; that is not truncation.
  const result = analyzePullRequest(docs(30), defaultConfig, { expectedFileCount: 40 });

  assert.ok(!result.findings.some((finding) => finding.ruleId === "incomplete-review"));
}

function docs(count: number): ChangedFile[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `docs/page-${index}.md`,
    status: "modified",
    additions: 1,
    deletions: 0
  }));
}
