import type { Finding, ReviewResult, SuppressedFinding } from "../analysis/finding.js";
import type { Severity } from "../analysis/severity.js";
import { areaOf } from "../rules/areas.js";

export type SarifRule = { id: string; description: string };

const levels: Record<Severity, "error" | "warning" | "note"> = { high: "error", warning: "warning", info: "note" };

// SARIF 2.1.0 for GitHub code scanning and other SARIF viewers. Code scanning needs a file for
// every result, so findings about the pull request as a whole, such as large-diff, are left out.
export function renderSarif(result: ReviewResult, rules: SarifRule[]): string {
  const located = (finding: Finding) => finding.file !== undefined;
  const results = [
    ...result.findings.filter(located).map((finding) => sarifResult(finding)),
    ...(result.suppressed ?? []).filter(located).map((finding) => sarifResult(finding, finding))
  ];

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Prism Review",
              informationUri: "https://github.com/gabrielolvv/prism-review",
              rules: rules.map((rule) => ({
                id: rule.id,
                name: rule.id,
                shortDescription: { text: rule.description },
                helpUri: "https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md",
                // Code scanning lets alerts be filtered by tag.
                properties: { tags: [areaOf(rule.id)] }
              }))
            }
          },
          results
        }
      ]
    },
    null,
    2
  );
}

function sarifResult(finding: Finding, suppressed?: SuppressedFinding) {
  return {
    ruleId: finding.ruleId,
    level: levels[finding.severity],
    message: { text: [finding.message, finding.recommendation].filter(Boolean).join(" ") },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: fileUri(finding.file ?? "") },
          ...(finding.line === undefined ? {} : { region: { startLine: finding.line } })
        }
      }
    ],
    // An inline suppression is SARIF's in-source suppression; code scanning shows it as dismissed.
    ...(suppressed === undefined
      ? {}
      : { suppressions: [{ kind: "inSource", justification: suppressed.suppressionReason }] })
  };
}

// A relative URI: each path segment is percent-encoded, so spaces, `#`, and `?` stay part of the name.
function fileUri(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
