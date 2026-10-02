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
    `#### ${capitalize(finding.severity)} - ${escapeText(finding.title)}`,
    "",
    escapeText(finding.message)
  ];

  if (finding.file) {
    sections.push("", `File: ${codeSpan(finding.file)}`);
  }

  if (finding.recommendation) {
    sections.push("", `Recommendation: ${escapeText(finding.recommendation)}`);
  }

  return sections.join("\n");
}

// Finding text is plain prose, so Markdown and HTML in it are shown literally. Newlines are folded
// because a new line could start a heading, list, or HTML block in the middle of the comment.
function escapeText(value: string): string {
  return value.replace(/\r\n?|\n/g, " ").replace(/[\\`*_[\]<>#|!~&]/g, "\\$&");
}

// File paths come from the pull request. A code span keeps them literal, and GitHub does not
// turn @mentions or #references inside one into notifications or links.
function codeSpan(value: string): string {
  const content = value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";

  return `${fence}${padding}${content}${padding}${fence}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
