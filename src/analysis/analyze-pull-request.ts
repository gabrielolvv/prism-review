import { Minimatch } from "minimatch";
import { changedLines, type ChangedFile } from "./changed-file.js";
import { countBySeverity, type Finding, type ReviewResult, type RiskLevel } from "./finding.js";
import type { Rule } from "./rule.js";
import { defaultConfigPath, type PrismConfig } from "../config/schema.js";
import { defaultRules } from "../rules/index.js";
import { compareSeverity } from "./severity.js";
import { applySuppressions } from "./suppressions.js";

export type AnalyzeOptions = {
  rules?: Rule[];
  configPath?: string;
  expectedFileCount?: number;
};

export function analyzePullRequest(
  files: ChangedFile[],
  config: PrismConfig,
  options: AnalyzeOptions = {}
): ReviewResult {
  const { rules = defaultRules, configPath = defaultConfigPath, expectedFileCount } = options;
  // Compiled once; `dot` lets `dist/**` cover `dist/.cache/` and `**/*.yml` cover `.github/`.
  const ignored = config.ignorePaths.map((glob) => new Minimatch(glob, { dot: true }));
  const isIgnored = (path: string) => ignored.some((matcher) => matcher.match(path));
  const pathOverrides = config.overrides.map((override) => ({
    matchers: override.paths.map((glob) => new Minimatch(glob, { dot: true })),
    severity: override.severity
  }));
  // A file moved into an ignored directory is still reviewed, so a rename cannot hide a change.
  const reviewed = files.filter(
    (file) => !(isIgnored(file.path) && (file.previousPath === undefined || isIgnored(file.previousPath)))
  );
  const all = rules
    .flatMap((rule) =>
      rule.run({ files: rule.seesIgnoredFiles ? files : reviewed, config, configPath, expectedFileCount })
    )
    .flatMap((finding) => applySeverityOverride(finding, config, pathOverrides))
    .sort((left, right) => compareSeverity(left.severity, right.severity));
  // The rules ignorePaths cannot hide cannot be suppressed inline either.
  const protectedRules = new Set(rules.filter((rule) => rule.seesIgnoredFiles).map((rule) => rule.id));
  const { kept: findings, suppressed } = applySuppressions(files, all, protectedRules);

  return {
    summary: buildSummary(reviewed.length, files.length - reviewed.length, findings, suppressed.length),
    riskLevel: calculateRiskLevel(reviewed, findings, config),
    findings,
    suppressed
  };
}

type PathOverride = { matchers: Minimatch[]; severity: PrismConfig["severity"] };

// The global `severity` first, then each `overrides` entry whose paths match the finding's file.
function applySeverityOverride(finding: Finding, config: PrismConfig, pathOverrides: PathOverride[]): Finding[] {
  let override = config.severity[finding.ruleId];
  const file = finding.file;
  if (file !== undefined) {
    for (const entry of pathOverrides) {
      if (entry.severity[finding.ruleId] !== undefined && entry.matchers.some((matcher) => matcher.match(file))) {
        override = entry.severity[finding.ruleId];
      }
    }
  }
  if (override === undefined) {
    return [finding];
  }

  return override === "off" ? [] : [{ ...finding, severity: override }];
}

function buildSummary(
  reviewedCount: number,
  ignoredCount: number,
  findings: Finding[],
  suppressedCount: number
): string {
  const ignored = ignoredCount > 0 ? `, ${ignoredCount} more ignored by ignorePaths` : "";
  const reviewed = `Reviewed ${reviewedCount} changed file(s)${ignored}.`;
  const found =
    findings.length === 0
      ? "No configured risk signals were detected."
      : `Found ${countBySeverity(findings, "high")} high-risk and ${countBySeverity(findings, "warning")} warning-level signal(s).`;
  const suppressed = suppressedCount > 0 ? ` ${suppressedCount} finding(s) were suppressed inline.` : "";

  return `${reviewed} ${found}${suppressed}`;
}

function calculateRiskLevel(
  files: ChangedFile[],
  findings: Finding[],
  config: PrismConfig
): RiskLevel {
  if (findings.some((finding) => finding.severity === "high")) {
    return "high";
  }

  // Turning large-diff off also turns off the size check it shares with the risk level.
  const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
  const largeDiff = config.risk.largeDiff;
  const sizeCounts = config.severity["large-diff"] !== "off";
  if (
    countBySeverity(findings, "warning") >= 2 ||
    (sizeCounts && (files.length > largeDiff.maxFiles || totalChangedLines > largeDiff.maxChangedLines))
  ) {
    return "medium";
  }

  return "low";
}
