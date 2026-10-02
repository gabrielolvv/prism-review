import type { Finding, ReviewResult } from "../analysis/finding.js";
import type { Severity } from "../analysis/severity.js";

export type AnnotationOptions = {
  includeLowSeverity: boolean;
};

const commands: Record<Severity, string> = {
  high: "error",
  warning: "warning",
  info: "notice"
};

// Renders findings as workflow commands, which GitHub shows beside the file in the pull request diff.
// Findings without a file have nowhere to attach and stay in the comment only.
export function renderAnnotations(
  result: ReviewResult,
  options: AnnotationOptions = { includeLowSeverity: false }
): string[] {
  return result.findings
    .filter((finding) => finding.file !== undefined)
    .filter((finding) => options.includeLowSeverity || finding.severity !== "info")
    .map(renderAnnotation);
}

function renderAnnotation(finding: Finding): string {
  const properties = [`file=${escapeProperty(finding.file ?? "")}`];
  if (finding.line !== undefined) {
    properties.push(`line=${finding.line}`);
  }
  properties.push(`title=${escapeProperty(`Prism Review: ${finding.title}`)}`);

  const message = finding.recommendation
    ? `${finding.message}\n\nRecommendation: ${finding.recommendation}`
    : finding.message;

  return `::${commands[finding.severity]} ${properties.join(",")}::${escapeData(message)}`;
}

// File paths and messages come from the pull request. Escaping keeps a crafted path such as
// "a\n::stop-commands::x" inside its own annotation instead of starting a new workflow command.
function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}
