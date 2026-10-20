import type { Finding, ReviewResult } from "./finding.js";
import { isAtLeast } from "./severity.js";

export type FailOn = "never" | "warning" | "high";

// Returns the findings that make the check fail under `failOn`, or none when it should pass.
export function failingFindings(result: ReviewResult, failOn: FailOn): Finding[] {
  if (failOn === "never") {
    return [];
  }

  return result.findings.filter((finding) => isAtLeast(finding.severity, failOn));
}

export function describeFailure(failing: Finding[], failOn: FailOn): string {
  const severities = failOn === "high" ? "high-risk" : "warning or high-risk";
  return `Prism Review found ${failing.length} ${severities} finding(s), and check.failOn is "${failOn}".`;
}
