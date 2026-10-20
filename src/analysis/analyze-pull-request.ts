import { minimatch } from "minimatch";
import { changedLines, type ChangedFile } from "./changed-file.js";
import type { Finding, ReviewResult, RiskLevel } from "./finding.js";
import type { Rule } from "./rule.js";
import { defaultConfigPath, type PrismConfig } from "../config/schema.js";
import { defaultRules } from "../rules/index.js";
import { compareSeverity } from "./severity.js";

export type AnalyzeOptions = {
  rules?: Rule[];
  configPath?: string;
};

export function analyzePullRequest(
  files: ChangedFile[],
  config: PrismConfig,
  options: AnalyzeOptions = {}
): ReviewResult {
  const { rules = defaultRules, configPath = defaultConfigPath } = options;
  const reviewed = files.filter((file) => !config.ignorePaths.some((glob) => minimatch(file.path, glob)));
  const findings = rules
    .flatMap((rule) => rule.run({ files: rule.seesIgnoredFiles ? files : reviewed, config, configPath }))
    .flatMap((finding) => applySeverityOverride(finding, config))
    .sort((left, right) => compareSeverity(left.severity, right.severity));

  return {
    summary: buildSummary(reviewed.length, files.length - reviewed.length, findings),
    riskLevel: calculateRiskLevel(reviewed, findings, config),
    findings
  };
}

function applySeverityOverride(finding: Finding, config: PrismConfig): Finding[] {
  const override = config.severity[finding.ruleId];
  if (override === undefined) {
    return [finding];
  }

  return override === "off" ? [] : [{ ...finding, severity: override }];
}

function buildSummary(reviewedCount: number, ignoredCount: number, findings: Finding[]): string {
  const ignored = ignoredCount > 0 ? `, ${ignoredCount} more ignored by ignorePaths` : "";
  const reviewed = `Reviewed ${reviewedCount} changed file(s)${ignored}.`;
  if (findings.length === 0) {
    return `${reviewed} No configured risk signals were detected.`;
  }

  const highCount = findings.filter((finding) => finding.severity === "high").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  return `${reviewed} Found ${highCount} high-risk and ${warningCount} warning-level signal(s).`;
}

function calculateRiskLevel(
  files: ChangedFile[],
  findings: Finding[],
  config: PrismConfig
): RiskLevel {
  if (findings.some((finding) => finding.severity === "high")) {
    return "high";
  }

  const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
  const largeDiff = config.risk.largeDiff;
  if (
    findings.filter((finding) => finding.severity === "warning").length >= 2 ||
    files.length > largeDiff.maxFiles ||
    totalChangedLines > largeDiff.maxChangedLines
  ) {
    return "medium";
  }

  return "low";
}
