import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import { failingFindings } from "../../src/analysis/check-outcome.js";
import { parseConfig } from "../../src/config/load-config.js";
import { defaultConfig } from "../../src/config/schema.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

const files = loadDiffFixture("fixtures/diffs/risky-auth-change.diff");

export function testSeverityOverridesChangeFindingsAndRisk(): void {
  const config = parseConfig(
    ["severity:", "  sensitive-files: warning", "  missing-tests: info", "  dependency-risk: high", ""].join("\n"),
    "test"
  );

  const result = analyzePullRequest(files, config);

  assert.deepEqual(
    result.findings.map((finding) => [finding.ruleId, finding.severity]),
    [
      ["dependency-risk", "high"],
      ["sensitive-files", "warning"],
      ["missing-tests", "info"]
    ]
  );
  assert.equal(result.riskLevel, "high");
  assert.deepEqual(failingFindings(result, "high").map((finding) => finding.ruleId), ["dependency-risk"]);
  assert.doesNotMatch(renderMarkdown(result), /Source changed without tests/);
}

export function testSeverityOverrideOffRemovesARule(): void {
  const config = parseConfig("severity:\n  sensitive-files: off\n", "test");

  const result = analyzePullRequest(files, config);

  assert.ok(!result.findings.some((finding) => finding.ruleId === "sensitive-files"));
  assert.equal(result.riskLevel, "medium");
}

export function testSeverityOverridesRejectUnknownRules(): void {
  assert.deepEqual(defaultConfig.severity, {});
  assert.throws(
    () => parseConfig("severity:\n  missing-test: info\n", "test"),
    /severity: Unknown rule "missing-test"/
  );
  assert.throws(() => parseConfig("severity:\n  missing-tests: critical\n", "test"), /severity\.missing-tests/);
}
