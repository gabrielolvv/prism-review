import type { Severity } from "./severity.js";

export type Finding = {
  ruleId: string;
  title: string;
  severity: Severity;
  file?: string;
  line?: number;
  // Every line the finding covers, when there are several; `line` is the first.
  lines?: number[];
  message: string;
  recommendation?: string;
};

// A finding a `prism-review-ignore` comment acknowledged, kept so the review can list it.
export type SuppressedFinding = Finding & { suppressionReason: string };

export type RiskLevel = "low" | "medium" | "high";

export type ReviewResult = {
  summary: string;
  riskLevel: RiskLevel;
  findings: Finding[];
  suppressed?: SuppressedFinding[];
};

export function countBySeverity(findings: Finding[], severity: Severity): number {
  return findings.filter((finding) => finding.severity === severity).length;
}
