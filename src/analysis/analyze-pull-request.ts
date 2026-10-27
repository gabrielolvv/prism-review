import { Minimatch } from "minimatch";
import { changedLines, type ChangedFile } from "./changed-file.js";
import { countBySeverity, type Finding, type ReviewResult, type RiskLevel } from "./finding.js";
import type { Rule } from "./rule.js";
import { defaultConfigPath, type PrismConfig } from "../config/schema.js";
import { defaultRules } from "../rules/index.js";
import { compareSeverity } from "./severity.js";
import { applySuppressions } from "./suppressions.js";
import { dependencyChanges } from "./manifest-dependencies.js";

export type AnalyzeOptions = {
  rules?: Rule[];
  configPath?: string;
  expectedFileCount?: number;
  // Files marked `linguist-generated` or `linguist-vendored`, which are left out like `ignorePaths`.
  isGenerated?: (path: string) => boolean;
  // Lockfiles that exist on the base commit, for `stale-lockfile`.
  existingLockfiles?: ReadonlySet<string>;
};

export function analyzePullRequest(
  files: ChangedFile[],
  config: PrismConfig,
  options: AnalyzeOptions = {}
): ReviewResult {
  const {
    rules = defaultRules,
    configPath = defaultConfigPath,
    expectedFileCount,
    isGenerated = () => false,
    existingLockfiles
  } = options;
  const changedPaths = new Set(files.flatMap((file) => [file.path, ...(file.previousPath === undefined ? [] : [file.previousPath])]));
  const pathOverrides = config.overrides.map((override) => ({
    matchers: override.paths.map((glob) => new Minimatch(glob, { dot: true })),
    severity: override.severity
  }));
  const { reviewed, ignoredByConfig, generated } = partitionFiles(files, config, isGenerated);
  const all = rules
    .flatMap((rule) =>
      rule.run({
        files: rule.seesIgnoredFiles ? files : reviewed,
        config,
        configPath,
        expectedFileCount,
        changedPaths,
        ...(existingLockfiles === undefined ? {} : { existingLockfiles })
      })
    )
    .flatMap((finding) => applySeverityOverride(finding, config, pathOverrides))
    .sort((left, right) => compareSeverity(left.severity, right.severity));
  // The rules ignorePaths cannot hide cannot be suppressed inline either.
  const protectedRules = new Set(rules.filter((rule) => rule.seesIgnoredFiles).map((rule) => rule.id));
  const { kept: findings, suppressed } = applySuppressions(files, all, protectedRules);

  return {
    summary: buildSummary(reviewed.length, ignoredByConfig.size, generated.size, findings, suppressed.length),
    riskLevel: calculateRiskLevel(reviewed, findings, config),
    findings,
    suppressed,
    ...nonEmpty("dependencyChanges", dependencyChanges(reviewed))
  };
}

export type FilePartition = {
  reviewed: ChangedFile[];
  ignoredByConfig: Set<ChangedFile>;
  generated: Set<ChangedFile>;
};

// Splits the files into the ones the rules review and the ones `ignorePaths` or .gitattributes
// leave out.
export function partitionFiles(
  files: ChangedFile[],
  config: PrismConfig,
  isGenerated: (path: string) => boolean = () => false
): FilePartition {
  // Compiled once; `dot` lets `dist/**` cover `dist/.cache/` and `**/*.yml` cover `.github/`.
  const ignored = config.ignorePaths.map((glob) => new Minimatch(glob, { dot: true }));
  const isIgnored = (path: string) => ignored.some((matcher) => matcher.match(path));
  // A file moved into an ignored directory is still reviewed, so a rename cannot hide a change.
  const leftOut = (file: ChangedFile, excluded: (path: string) => boolean) =>
    excluded(file.path) && (file.previousPath === undefined || excluded(file.previousPath));
  const ignoredByConfig = new Set(files.filter((file) => leftOut(file, isIgnored)));
  const generated = new Set(
    files.filter((file) => !ignoredByConfig.has(file) && leftOut(file, (path) => isIgnored(path) || isGenerated(path)))
  );
  const reviewed = files.filter((file) => !ignoredByConfig.has(file) && !generated.has(file));

  return { reviewed, ignoredByConfig, generated };
}

function nonEmpty<Key extends string, Value>(key: Key, values: Value[]): { [K in Key]?: Value[] } {
  return (values.length > 0 ? { [key]: values } : {}) as { [K in Key]?: Value[] };
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
  generatedCount: number,
  findings: Finding[],
  suppressedCount: number
): string {
  const ignored = ignoredCount > 0 ? `, ${ignoredCount} more ignored by ignorePaths` : "";
  const generated =
    generatedCount > 0 ? `, ${generatedCount} more marked generated or vendored in .gitattributes` : "";
  const reviewed = `Reviewed ${reviewedCount} changed file(s)${ignored}${generated}.`;
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
