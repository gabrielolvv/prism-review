import { isHiddenCodePoint } from "../analysis/hidden-characters.js";
import type { Finding, ReviewResult } from "../analysis/finding.js";
import { compareSeverity, type Severity } from "../analysis/severity.js";

export type TextOptions = {
  includeLowSeverity: boolean;
  // ANSI colors, for a terminal.
  color: boolean;
};

const styles = {
  high: "1;31",
  warning: "33",
  info: "36",
  bold: "1",
  dim: "2"
} as const;
const labels: Record<Severity, string> = { high: "high", warning: "warning", info: "info" };

// A compact review for a terminal or a pre-commit hook: one entry per finding, most severe first,
// with the file and line in the `path:line` form editors and terminals open.
export function renderText(result: ReviewResult, options: TextOptions): string {
  const paint = (style: keyof typeof styles, text: string) => (options.color ? `\u001b[${styles[style]}m${text}\u001b[0m` : text);
  const findings = (options.includeLowSeverity ? result.findings : result.findings.filter((finding) => finding.severity !== "info"))
    .slice()
    .sort(
      (left, right) =>
        compareSeverity(left.severity, right.severity) ||
        (left.file ?? "").localeCompare(right.file ?? "") ||
        (left.line ?? 0) - (right.line ?? 0)
    );
  const width = Math.max(0, ...findings.map((finding) => labels[finding.severity].length));

  const lines = [`${paint("bold", "Prism Review:")} ${paint(riskStyle(result.riskLevel), `${result.riskLevel} risk`)}. ${plain(result.summary)}`];
  if (findings.length > 0) {
    lines.push("");
  }
  for (const finding of findings) {
    const severity = labels[finding.severity].padEnd(width);
    lines.push(`${paint(finding.severity, severity)}  ${location(finding)}${plain(finding.title)} ${paint("dim", `[${finding.ruleId}]`)}`);
    lines.push(`${" ".repeat(width)}  ${plain(finding.message)}`);
  }

  const notes = [
    ...((result.suppressed?.length ?? 0) > 0 ? [`${result.suppressed?.length} finding(s) acknowledged inline.`] : []),
    ...((result.dependencyChanges?.length ?? 0) > 0 ? [`${result.dependencyChanges?.length} dependency change(s).`] : []),
    ...(findings.length > 0 || (result.dependencyChanges?.length ?? 0) > 0
      ? ["Use --format markdown for recommendations and the reviewer checklist."]
      : [])
  ];
  if (notes.length > 0) {
    lines.push("", paint("dim", notes.join(" ")));
  }

  return lines.join("\n");
}

function location(finding: Finding): string {
  if (finding.file === undefined) {
    return "";
  }
  return `${plain(finding.file)}${finding.line === undefined ? "" : `:${finding.line}`}  `;
}

function riskStyle(risk: ReviewResult["riskLevel"]): keyof typeof styles {
  return risk === "high" ? "high" : risk === "medium" ? "warning" : "bold";
}

// File paths and finding text can come from the pull request. Control characters, which could move
// the cursor or start an escape sequence in the terminal, and invisible or bidirectional characters
// are shown as escapes, and lines are joined.
function plain(value: string): string {
  return [...value.replace(/\r\n?|\n/g, " ")]
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      const control = codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
      return control || isHiddenCodePoint(codePoint) ? `\\u{${codePoint.toString(16).toUpperCase()}}` : char;
    })
    .join("");
}
