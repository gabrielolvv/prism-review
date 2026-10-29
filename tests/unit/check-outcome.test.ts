import assert from "node:assert/strict";
import { describeFailure, failingFindings } from "../../src/analysis/check-outcome.js";
import type { Finding, ReviewResult } from "../../src/analysis/finding.js";
import type { Severity } from "../../src/analysis/severity.js";
import { parseConfig } from "../../src/config/load-config.js";

export function testFailingFindingsFollowsThreshold(): void {
  const result = review(["high", "warning", "info"]);

  assert.deepEqual(severities(failingFindings(result, "never")), []);
  assert.deepEqual(severities(failingFindings(result, "high")), ["high"]);
  assert.deepEqual(severities(failingFindings(result, "warning")), ["high", "warning"]);
  assert.deepEqual(severities(failingFindings(review(["info"]), "warning")), []);
}

export function testDescribeFailureNamesThreshold(): void {
  assert.equal(
    describeFailure(review(["high", "warning"]).findings, "warning"),
    'Prism Review found 2 warning or high-risk finding(s), and check.failOn is "warning".'
  );
  assert.equal(
    describeFailure(review(["high"]).findings, "high"),
    'Prism Review found 1 high-risk finding(s), and check.failOn is "high".'
  );
  // The CLI's --fail-on takes precedence over the file, so the message names it instead.
  assert.equal(
    describeFailure(review(["high"]).findings, "high", "--fail-on"),
    'Prism Review found 1 high-risk finding(s), and --fail-on is "high".'
  );
}

export function testConfigNeverFailsByDefault(): void {
  assert.equal(parseConfig("", "test").check.failOn, "never");
  assert.equal(parseConfig("check:\n  failOn: high\n", "test").check.failOn, "high");
  assert.throws(() => parseConfig("check:\n  failOn: always\n", "test"), /check\.failOn/);
}

function review(levels: Severity[]): ReviewResult {
  const findings: Finding[] = levels.map((severity, index) => ({
    ruleId: `rule-${index}`,
    title: "Finding",
    severity,
    message: "Review this change."
  }));
  return { summary: "Reviewed.", riskLevel: "high", findings };
}

function severities(findings: Finding[]): Severity[] {
  return findings.map((finding) => finding.severity);
}
