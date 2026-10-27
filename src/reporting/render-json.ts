import { countBySeverity, type Finding, type ReviewResult } from "../analysis/finding.js";

// The review as JSON, for scripts and other tools. Field names are stable.
export function renderJson(result: ReviewResult): string {
  const suppressed = result.suppressed ?? [];

  return JSON.stringify(
    {
      riskLevel: result.riskLevel,
      summary: result.summary,
      counts: {
        high: countBySeverity(result.findings, "high"),
        warning: countBySeverity(result.findings, "warning"),
        info: countBySeverity(result.findings, "info"),
        suppressed: suppressed.length
      },
      findings: result.findings.map(plainFinding),
      suppressed: suppressed.map((finding) => ({ ...plainFinding(finding), reason: finding.suppressionReason }))
    },
    null,
    2
  );
}

function plainFinding(finding: Finding) {
  return {
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: finding.title,
    message: finding.message,
    ...(finding.recommendation === undefined ? {} : { recommendation: finding.recommendation }),
    ...(finding.file === undefined ? {} : { file: finding.file }),
    ...(finding.line === undefined ? {} : { line: finding.line }),
    ...(finding.lines === undefined ? {} : { lines: finding.lines })
  };
}
