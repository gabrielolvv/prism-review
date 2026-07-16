import type { ReviewResult } from "../analysis/finding.js";

export const PRISM_COMMENT_MARKER = "<!-- prism-review-comment -->";

export type RenderOptions = {
  includeLowSeverity: boolean;
};

export function renderMarkdown(
  result: ReviewResult,
  options: RenderOptions = { includeLowSeverity: false }
): string {
  const findings = options.includeLowSeverity
    ? result.findings
    : result.findings.filter((finding) => finding.severity !== "info");

  return [
    PRISM_COMMENT_MARKER,
    "",
    "## Prism Review",
    "",
    `Risk level: **${capitalize(result.riskLevel)}**`,
    "",
    "### Summary",
    "",
    result.summary,
    "",
    "### Findings",
    "",
    findings.length === 0
      ? "No warning or high-risk findings were detected."
      : findings.map(renderFinding).join("\n\n"),
    "",
    "### Suggested Review Checklist",
    "",
    "- Are tests covering the changed behavior?",
    "- Are security-sensitive changes reviewed by the right owner?",
    "- Are deployment, migration, or rollback risks understood?",
    "- Are new dependencies necessary and trusted?"
  ].join("\n");
}

function renderFinding(finding: ReviewResult["findings"][number]): string {
  const sections = [
    `#### ${capitalize(finding.severity)} - ${finding.title}`,
    "",
    finding.message
  ];

  if (finding.file) {
    sections.push("", `File: \`${finding.file}\``);
  }

  if (finding.recommendation) {
    sections.push("", `Recommendation: ${finding.recommendation}`);
  }

  return sections.join("\n");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
