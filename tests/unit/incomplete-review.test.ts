import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

const files: ChangedFile[] = Array.from({ length: 3 }, (_, index) => ({
  path: `docs/page-${index}.md`,
  status: "modified",
  additions: 1,
  deletions: 0
}));

export function testIncompleteReviewRuleReportsMissingFiles(): void {
  const result = analyzePullRequest(files, defaultConfig, { expectedFileCount: 3500 });
  const finding = result.findings.find((candidate) => candidate.ruleId === "incomplete-review");

  assert.equal(finding?.severity, "high");
  assert.equal(
    finding?.message,
    "This pull request changes 3500 files, but GitHub returned 3, so 3497 files were not reviewed."
  );
  assert.equal(result.riskLevel, "high");
}

export function testIncompleteReviewRuleIsQuietWhenEveryFileArrived(): void {
  const ignoring = prismConfigSchema.parse({ ignorePaths: ["docs/**"] });

  for (const [config, expectedFileCount] of [
    [defaultConfig, 3],
    [defaultConfig, undefined],
    // Ignored files still arrived, so they do not count as missing.
    [ignoring, 3]
  ] as const) {
    const result = analyzePullRequest(files, config, { expectedFileCount });
    assert.ok(!result.findings.some((finding) => finding.ruleId === "incomplete-review"), String(expectedFileCount));
  }
}
