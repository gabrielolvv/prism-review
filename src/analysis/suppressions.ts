import { patchLines } from "./added-lines.js";
import type { ChangedFile } from "./changed-file.js";
import type { Finding, SuppressedFinding } from "./finding.js";

// `prism-review-ignore rule-id[, rule-id] -- reason` in a comment after the code, or alone on the line above.
// The reason is required, so every suppression says why it is safe.
const marker = /prism-review-ignore\s+([\w-]+(?:\s*,\s*[\w-]+)*)\s*(?:--|:)\s*(.*?)\s*(?:\*\/|-->|%>|#>)?\s*$/;
const maxReasonLength = 200;
// A marker alone on a comment line covers the line below; one after code covers only its own line.
const standalone = /^\s*(?:#|\/\/|\/\*+|--|<!--|;|%|<%#|\{\/\*|'|REM\b)?\s*prism-review-ignore\b/i;

type Markers = Map<string, Map<number, Map<string, string>>>;

// Splits findings into kept and suppressed. Findings without a line, and findings from rules that
// `protectedRules` names, are always kept: a pull request must not be able to hide them.
export function applySuppressions(
  files: ChangedFile[],
  findings: Finding[],
  protectedRules: Set<string>
): { kept: Finding[]; suppressed: SuppressedFinding[] } {
  const markers = findMarkers(files);
  const kept: Finding[] = [];
  const suppressed: SuppressedFinding[] = [];

  for (const finding of findings) {
    const reason = protectedRules.has(finding.ruleId) ? undefined : reasonFor(finding, markers);
    if (reason === undefined) {
      kept.push(finding);
    } else {
      suppressed.push({ ...finding, suppressionReason: reason });
    }
  }

  return { kept, suppressed };
}

function reasonFor(finding: Finding, markers: Markers): string | undefined {
  const lines = finding.lines ?? (finding.line === undefined ? [] : [finding.line]);
  const fileMarkers = finding.file === undefined ? undefined : markers.get(finding.file);
  if (lines.length === 0 || fileMarkers === undefined) {
    return undefined;
  }

  const reasons = lines.map((line) => fileMarkers.get(line)?.get(finding.ruleId));
  return reasons.every((reason) => reason !== undefined) ? reasons[0] : undefined;
}

function findMarkers(files: ChangedFile[]): Markers {
  const markers: Markers = new Map();

  for (const file of files) {
    if (file.patch === undefined || !file.patch.includes("prism-review-ignore")) {
      continue;
    }
    const byLine = new Map<number, Map<string, string>>();
    for (const { line, content } of patchLines(file.patch)) {
      const match = marker.exec(content);
      const reason = match?.[2]?.trim().slice(0, maxReasonLength) ?? "";
      if (match === null || !/\w/.test(reason)) {
        continue;
      }
      for (const target of standalone.test(content) ? [line, line + 1] : [line]) {
        const rules = byLine.get(target) ?? new Map<string, string>();
        for (const ruleId of (match[1] ?? "").split(",").map((id) => id.trim())) {
          rules.set(ruleId, reason);
        }
        byLine.set(target, rules);
      }
    }
    markers.set(file.path, byLine);
  }

  return markers;
}
