import type { Finding, ReviewResult, SuppressedFinding } from "../analysis/finding.js";
import { isHiddenCodePoint } from "../analysis/hidden-characters.js";
import { compareSeverity, type Severity } from "../analysis/severity.js";
import { areaOf, areas } from "../rules/areas.js";
import { checklistQuestions } from "./checklist.js";
import { ruleDocsUrl } from "./rule-docs.js";
import { compareWithPrevious, renderState, type Comparison, type PreviousFindings } from "./review-state.js";

export const PRISM_COMMENT_MARKER = "<!-- prism-review-comment -->";

export type RenderOptions = {
  includeLowSeverity: boolean;
  // The findings an earlier review comment recorded, to mark what is new since then.
  previous?: PreviousFindings;
  // Records the findings in the comment, for the next run to compare with.
  recordState?: boolean;
  // Questions added to the checklist on every review.
  checklist?: readonly string[];
  // The code owners of a file, from the repository's CODEOWNERS.
  ownersOf?: (path: string) => readonly string[];
};

export function renderMarkdown(
  result: ReviewResult,
  options: RenderOptions = { includeLowSeverity: false }
): string {
  const findings = options.includeLowSeverity
    ? result.findings
    : result.findings.filter((finding) => finding.severity !== "info");
  const suppressed = renderSuppressed(result.suppressed ?? []);
  const comparison = options.previous === undefined ? undefined : compareWithPrevious(findings, options.previous);
  const changes = comparison === undefined ? [] : [renderChanges(comparison), ""];
  const state = options.recordState ? ["", renderState(findings)] : [];
  const owners = (finding: Finding) =>
    finding.file === undefined || options.ownersOf === undefined ? [] : options.ownersOf(finding.file);
  const checklist = [
    ...checklistQuestions(findings).map((question) => `- ${escapeText(question)}`),
    ...renderOwnersQuestion(findings.flatMap(owners)),
    ...(options.checklist ?? []).map((question) => `- ${escapeText(question)}`)
  ];
  // Everything else that can grow comes out of the findings' share of the size limit.
  const budget = maxFindingsLength - [...suppressed, ...changes, ...state, ...checklist].join("\n").length;

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
    ...changes,
    findings.length === 0
      ? "No warning or high-risk findings were detected."
      : renderFindings(findings, budget, (finding) =>
          renderFinding(finding, comparison?.isNew(finding) ?? false, owners(finding))
        ),
    "",
    ...suppressed,
    "### Suggested Review Checklist",
    "",
    ...checklist,
    ...state
  ].join("\n");
}

function renderChanges({ newCount, noLongerReported }: Comparison): string {
  const resolved = noLongerReported.reduce((total, [, count]) => total + count, 0);
  if (newCount === 0 && resolved === 0) {
    return "No findings were added or resolved since the previous review.";
  }

  const rules = noLongerReported.map(([ruleId, count]) => `${codeSpan(ruleId)} (${count})`).join(", ");
  return `Since the previous review: ${newCount} new finding(s), ${resolved} no longer reported${resolved > 0 ? ` (${rules})` : ""}.`;
}

// GitHub rejects comments over 65536 characters, and the job summary is capped too, so the list
// stops early and says how much is left out. Findings are sorted by severity, so the most
// important ones are the ones shown.
const maxFindingsLength = 55_000;

// The overview line and area headings, taken from the budget before the findings.
const groupingReserve = 1_000;

function renderFindings(findings: Finding[], budget: number, render: (finding: Finding) => string): string {
  // Findings from one area are listed as they are; from several, they are grouped by area.
  const grouped = new Set(findings.map((finding) => areaOf(finding.ruleId))).size > 1;
  const shown: Array<{ finding: Finding; block: string }> = [];
  let length = 0;

  for (const finding of findings) {
    const block = render(finding);
    if (length + block.length > budget - (grouped ? groupingReserve : 0)) {
      break;
    }

    shown.push({ finding, block });
    length += block.length + 2;
  }

  const rendered = grouped ? renderGroups(findings, shown) : shown.map(({ block }) => block);
  const hidden = findings.length - shown.length;
  if (hidden > 0) {
    rendered.push(
      `${hidden} more finding(s) are not shown here to keep the comment within GitHub's size limit. Enable annotations or run the CLI to see every finding.`
    );
  }

  return rendered.join("\n\n");
}

// The most severe area comes first, and areas with the same top severity keep their usual order.
// Counts include findings left out for size, so the overview stays complete.
function renderGroups(findings: Finding[], shown: Array<{ finding: Finding; block: string }>): string[] {
  const groups = areas
    .map((area) => ({
      area,
      all: findings.filter((finding) => areaOf(finding.ruleId) === area.id),
      blocks: shown.filter(({ finding }) => areaOf(finding.ruleId) === area.id).map(({ block }) => block)
    }))
    .filter((group) => group.all.length > 0)
    .sort((left, right) => compareSeverity(topSeverity(left.all), topSeverity(right.all)));

  const overview = groups.map(({ area, all }) => `${area.title} (${all.length})`).join(", ");
  return [
    `${findings.length} findings in ${groups.length} areas: ${overview}.`,
    ...groups
      .filter((group) => group.blocks.length > 0)
      .map(({ area, all, blocks }) => {
        const count = blocks.length === all.length ? `${all.length}` : `${blocks.length} of ${all.length} shown`;
        return [`### ${area.title} (${count})`, ...blocks].join("\n\n");
      })
  ];
}

function topSeverity(findings: Finding[]): Severity {
  return findings.map((finding) => finding.severity).sort(compareSeverity)[0] ?? "info";
}

// Suppressed findings stay visible, so a reviewer can check each reason. They share the comment's
// size limit with the findings, from a smaller budget of their own.
const maxSuppressedShown = 50;
const maxSuppressedLength = 10_000;

function renderSuppressed(suppressed: SuppressedFinding[]): string[] {
  if (suppressed.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let length = 0;
  for (const finding of suppressed.slice(0, maxSuppressedShown)) {
    const where = finding.file === undefined ? "" : ` on line ${finding.line ?? "?"} of ${codeSpan(finding.file)}`;
    const line = `- ${codeSpan(finding.ruleId)}${where}: ${escapeText(finding.suppressionReason)}`;
    if (length + line.length > maxSuppressedLength) {
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  if (suppressed.length > lines.length) {
    lines.push(`- ${suppressed.length - lines.length} more suppressed finding(s) are not shown.`);
  }

  return ["### Suppressed Inline", "", ...lines, ""];
}

function renderFinding(finding: Finding, isNew: boolean, owners: readonly string[]): string {
  const sections = [
    `#### ${capitalize(finding.severity)} - ${escapeText(finding.title)}${isNew ? " (new)" : ""}`,
    "",
    escapeText(finding.message)
  ];

  if (finding.file) {
    const line = finding.line === undefined ? "" : `, line ${finding.line}`;
    sections.push("", `File: ${codeSpan(finding.file)}${line}`);
  }

  if (owners.length > 0) {
    sections.push("", `Owners: ${listOwners(owners)}`);
  }

  if (finding.recommendation) {
    sections.push("", `Recommendation: ${escapeText(finding.recommendation)}`);
  }

  sections.push("", renderRule(finding.ruleId));
  return sections.join("\n");
}

// Owners are shown in code spans, where GitHub does not turn @mentions into notifications.
const maxOwnersShown = 5;

function listOwners(owners: readonly string[]): string {
  const unique = [...new Set(owners)];
  const shown = unique.slice(0, maxOwnersShown).map(codeSpan).join(", ");
  return unique.length > maxOwnersShown ? `${shown} and ${unique.length - maxOwnersShown} more` : shown;
}

function renderOwnersQuestion(owners: readonly string[]): string[] {
  return owners.length === 0 ? [] : [`- Have the code owners of the flagged files, ${listOwners(owners)}, reviewed the change?`];
}

// The rule id is what an inline suppression names, and the link explains the rule and its options.
function renderRule(ruleId: string): string {
  const url = ruleDocsUrl(ruleId);
  return `Rule: ${url === undefined ? codeSpan(ruleId) : `[${codeSpan(ruleId)}](${url})`}`;
}

export const LINE_COMMENT_MARKER = "prism-review-line";

// A review comment on one changed line. The marker names the rule, so a later run can find it.
export function renderLineComment(finding: Finding): string {
  return [
    `<!-- ${LINE_COMMENT_MARKER} ${finding.ruleId} -->`,
    `**${capitalize(finding.severity)}** - ${escapeText(finding.title)}`,
    "",
    escapeText(finding.message),
    ...(finding.recommendation ? ["", `Recommendation: ${escapeText(finding.recommendation)}`] : []),
    "",
    renderRule(finding.ruleId)
  ].join("\n");
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
