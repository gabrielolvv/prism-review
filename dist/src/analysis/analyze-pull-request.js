import { changedLines } from "./changed-file.js";
import { defaultRules } from "../rules/index.js";
import { compareSeverity } from "./severity.js";
export function analyzePullRequest(files, config, rules = defaultRules) {
    const findings = rules
        .flatMap((rule) => rule.run({ files, config }))
        .sort((left, right) => compareSeverity(left.severity, right.severity));
    return {
        summary: buildSummary(files, findings),
        riskLevel: calculateRiskLevel(files, findings, config),
        findings
    };
}
function buildSummary(files, findings) {
    if (findings.length === 0) {
        return `Reviewed ${files.length} changed file(s). No configured risk signals were detected.`;
    }
    const highCount = findings.filter((finding) => finding.severity === "high").length;
    const warningCount = findings.filter((finding) => finding.severity === "warning").length;
    return `Reviewed ${files.length} changed file(s). Found ${highCount} high-risk and ${warningCount} warning-level signal(s).`;
}
function calculateRiskLevel(files, findings, config) {
    if (findings.some((finding) => finding.severity === "high")) {
        return "high";
    }
    const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
    const largeDiff = config.risk.largeDiff;
    if (findings.filter((finding) => finding.severity === "warning").length >= 2 ||
        files.length > largeDiff.maxFiles ||
        totalChangedLines > largeDiff.maxChangedLines) {
        return "medium";
    }
    return "low";
}
