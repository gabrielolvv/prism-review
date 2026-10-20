import type { ReviewResult } from "../analysis/finding.js";
import { isHiddenCodePoint } from "../analysis/hidden-characters.js";

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
    findings.length === 0 ? "No warning or high-risk findings were detected." : renderFindings(findings),
    "",
    "### Suggested Review Checklist",
    "",
    "- Are tests covering the changed behavior?",
    "- Are security-sensitive changes reviewed by the right owner?",
    "- Are deployment, migration, or rollback risks understood?",
    "- Are new dependencies necessary and trusted?"
  ].join("\n");
}

// GitHub rejects comments over 65536 characters, and the job summary is capped too, so the list
// stops early and says how much is left out. Findings are sorted by severity, so the most
// important ones are the ones shown.
const maxFindingsLength = 55_000;

function renderFindings(findings: ReviewResult["findings"]): string {
  const rendered: string[] = [];
  let length = 0;

  for (const finding of findings) {
    const block = renderFinding(finding);
    if (length + block.length > maxFindingsLength) {
      break;
    }

    rendered.push(block);
    length += block.length + 2;
  }

  const hidden = findings.length - rendered.length;
  if (hidden > 0) {
    rendered.push(
      `${hidden} more finding(s) are not shown here to keep the comment within GitHub's size limit. Enable annotations or run the CLI to see every finding.`
    );
  }

  return rendered.join("\n\n");
}

function renderFinding(finding: ReviewResult["findings"][number]): string {
  const sections = [
    `#### ${capitalize(finding.severity)} - ${escapeText(finding.title)}`,
    "",
    escapeText(finding.message)
  ];

  if (finding.file) {
    const line = finding.line === undefined ? "" : `, line ${finding.line}`;
    sections.push("", `File: ${codeSpan(finding.file)}${line}`);
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
  const content = showHiddenCharacters(value.replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";

  return `${fence}${padding}${content}${padding}${fence}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// A right-to-left override in a file name could make it display as a different name, so hidden
// characters are written out as \u{...} escapes, the way JavaScript would spell them.
function showHiddenCharacters(value: string): string {
  const backslash = String.fromCharCode(92);
  return [...value]
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return isHiddenCodePoint(codePoint) ? `${backslash}u{${codePoint.toString(16).toUpperCase()}}` : char;
    })
    .join("");
}
