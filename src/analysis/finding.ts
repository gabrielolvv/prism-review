import type { Severity } from "./severity.js";

export type Finding = {
  ruleId: string;
  title: string;
  severity: Severity;
  file?: string;
  line?: number;
  message: string;
  recommendation?: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type ReviewResult = {
  summary: string;
  riskLevel: RiskLevel;
  findings: Finding[];
};
