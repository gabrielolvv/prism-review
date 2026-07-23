import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig } from "../../src/config/schema.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testConfigChangeRuleFlagsDefaultConfig(): void {
  const files = loadDiffFixture("fixtures/diffs/config-change.diff");

  const result = analyzePullRequest(files, defaultConfig);
  const findings = configChangeFindings(result.findings);

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "high");
  assert.equal(findings[0]?.file, ".prism-review.yml");
  assert.equal(result.riskLevel, "high");
}

export function testConfigChangeRuleUsesConfiguredPath(): void {
  const files = [changedFile("config/prism.yml")];

  const custom = analyzePullRequest(files, defaultConfig, { configPath: "./config/prism.yml" });
  const fallback = analyzePullRequest(files, defaultConfig);

  assert.equal(configChangeFindings(custom.findings).length, 1);
  assert.equal(configChangeFindings(fallback.findings).length, 0);
}

export function testConfigChangeRuleFlagsRenamedConfig(): void {
  const files = [
    { ...changedFile("config/prism-review.yml"), status: "renamed" as const, previousPath: ".prism-review.yml" }
  ];

  const result = analyzePullRequest(files, defaultConfig);

  assert.equal(configChangeFindings(result.findings)[0]?.file, "config/prism-review.yml");
}

function configChangeFindings(findings: ReturnType<typeof analyzePullRequest>["findings"]) {
  return findings.filter((finding) => finding.ruleId === "config-change");
}

function changedFile(path: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 1 };
}
