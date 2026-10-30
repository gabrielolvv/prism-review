import type { Finding, ReviewResult, SuppressedFinding } from "../analysis/finding.js";
import type { Severity } from "../analysis/severity.js";
import { areaOf, type Area } from "../rules/areas.js";
import { ruleDocsUrl } from "./rule-docs.js";

export type SarifRule = { id: string; description: string };

const levels: Record<Severity, "error" | "warning" | "note"> = { high: "error", warning: "warning", info: "note" };
const severityOrder: Severity[] = ["info", "warning", "high"];
// Code scanning ranks alerts from security rules by this score: 7.0 to 8.9 is High, 4.0 to 6.9
// Medium, and 0.1 to 3.9 Low. Prism Review never claims Critical.
const securitySeverity: Record<Severity, string> = { high: "8.0", warning: "5.0", info: "2.0" };
// Areas whose rules are about security, which code scanning shows with a security severity and lets
// branch protection block on. Tests and the shape of the review are not.
const securityAreas = new Set<Area>(["secrets", "supply-chain", "infrastructure", "code"]);
const docsHome = "https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md";

// SARIF 2.1.0 for GitHub code scanning and other SARIF viewers. Code scanning needs a file for
// every result, so findings about the pull request as a whole, such as large-diff, are left out.
export function renderSarif(result: ReviewResult, rules: SarifRule[]): string {
  const located = (finding: Finding) => finding.file !== undefined;
  const findings = result.findings.filter(located);
  const suppressed = (result.suppressed ?? []).filter(located);
  const results = [...findings.map((finding) => sarifResult(finding)), ...suppressed.map((finding) => sarifResult(finding, finding))];

  // A rule's level is the most severe one it reported in this review, since some rules report both
  // warnings and high-risk findings.
  const reported = new Map<string, Severity>();
  for (const finding of [...findings, ...suppressed]) {
    const current = reported.get(finding.ruleId);
    if (current === undefined || severityOrder.indexOf(finding.severity) > severityOrder.indexOf(current)) {
      reported.set(finding.ruleId, finding.severity);
    }
  }

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
              rules: rules.map((rule) => sarifRule(rule, reported.get(rule.id)))
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

function sarifRule(rule: SarifRule, severity: Severity | undefined) {
  const area = areaOf(rule.id);
  const security = securityAreas.has(area);
  const helpUri = ruleDocsUrl(rule.id) ?? docsHome;
  return {
    id: rule.id,
    name: rule.id,
    shortDescription: { text: rule.description },
    fullDescription: { text: rule.description },
    helpUri,
    // Code scanning shows the help on each alert.
    help: {
      text: `${rule.description} See ${helpUri} for what the rule reads, what it leaves out, and how to turn it off.`,
      markdown: `${rule.description}\n\n[Read about \`${rule.id}\`](${helpUri}): what it reads, what it leaves out, and how to turn it off.`
    },
    ...(severity === undefined ? {} : { defaultConfiguration: { level: levels[severity] } }),
    // Code scanning lets alerts be filtered by tag. A `security` tag and a security severity let it
    // rank alerts as High, Medium, or Low and let branch protection block on them.
    properties: {
      tags: security ? [area, "security"] : [area],
      ...(security && severity !== undefined ? { "security-severity": securitySeverity[severity] } : {}),
      ...(!security && severity !== undefined ? { "problem.severity": severity === "high" ? "error" : severity === "warning" ? "warning" : "recommendation" } : {})
    }
  };
}

function sarifResult(finding: Finding, suppressed?: SuppressedFinding) {
  const uri = fileUri(finding.file ?? "");
  // A finding covers one file; its other lines are related locations, so code scanning shows one
  // alert per file and rule, as the comment does, and lists every line on it.
  const otherLines = (finding.lines ?? []).filter((line) => line !== finding.line);
  return {
    ruleId: finding.ruleId,
    level: levels[finding.severity],
    message: { text: [finding.message, finding.recommendation].filter(Boolean).join(" ") },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          ...(finding.line === undefined ? {} : { region: { startLine: finding.line } })
        }
      }
    ],
    ...(otherLines.length === 0
      ? {}
      : {
          relatedLocations: otherLines.map((line, index) => ({
            id: index + 1,
            physicalLocation: { artifactLocation: { uri }, region: { startLine: line } },
            message: { text: `Also line ${line}.` }
          }))
        }),
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
