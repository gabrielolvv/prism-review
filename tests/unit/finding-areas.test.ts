import assert from "node:assert/strict";
import type { Finding } from "../../src/analysis/finding.js";
import type { Severity } from "../../src/analysis/severity.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";
import { areaOf, areas, ruleAreas } from "../../src/rules/areas.js";
import { ruleIds } from "../../src/rules/ids.js";

export function testEveryRuleHasAnArea(): void {
  assert.deepEqual(Object.keys(ruleAreas).sort(), [...ruleIds].sort());
  const known = new Set<string>(areas.map((area) => area.id));
  assert.ok(Object.values(ruleAreas).every((area) => known.has(area)));
  assert.equal(areaOf("custom-rule"), "other");
  assert.equal(areaOf("constructor"), "other");
}

export function testRenderMarkdownGroupsFindingsByArea(): void {
  const markdown = renderMarkdown({
    summary: "Reviewed 6 changed file(s).",
    riskLevel: "high",
    findings: [
      finding("secret-in-diff", "high", "Secret added"),
      finding("public-exposure", "high", "Database open to the internet"),
      finding("unpinned-action", "warning", "Action pinned to a tag"),
      finding("lockfile-source", "warning", "Package from an unlisted source"),
      finding("missing-tests", "warning", "Source changed without tests"),
      finding("custom-rule", "warning", "Custom check")
    ]
  });

  assert.match(
    markdown,
    /^6 findings in 5 areas: Secrets \(1\), Infrastructure \(1\), Supply Chain \(2\), Tests \(1\), Other \(1\)\.$/m
  );
  // Each area follows the most severe one, and equally severe areas keep their usual order.
  assert.deepEqual(
    markdown.split("\n").filter((line) => /^###? /.test(line) || line.startsWith("#### ")),
    [
      "## Prism Review",
      "### Summary",
      "### Findings",
      "### Secrets (1)",
      "#### High - Secret added",
      "### Infrastructure (1)",
      "#### High - Database open to the internet",
      "### Supply Chain (2)",
      "#### Warning - Action pinned to a tag",
      "#### Warning - Package from an unlisted source",
      "### Tests (1)",
      "#### Warning - Source changed without tests",
      "### Other (1)",
      "#### Warning - Custom check",
      "### Suggested Review Checklist"
    ]
  );
}

export function testRenderMarkdownListsOneAreaWithoutGroups(): void {
  const markdown = renderMarkdown({
    summary: "Reviewed 2 changed file(s).",
    riskLevel: "high",
    findings: [finding("sql-injection", "high", "SQL built from values"), finding("risky-api", "warning", "Risky API used")]
  });

  assert.doesNotMatch(markdown, /findings in \d+ areas/);
  assert.doesNotMatch(markdown, /^### Code/m);
  assert.match(markdown, /^### Findings\n\n#### High - SQL built from values$/m);
}

export function testRenderMarkdownCountsFindingsLeftOutOfGroups(): void {
  const many = (ruleId: string, severity: Severity) =>
    Array.from({ length: 1000 }, (_, index) => ({
      ...finding(ruleId, severity, "Finding"),
      file: `src/${"nested/".repeat(10)}module-${index}.ts`
    }));
  const markdown = renderMarkdown({
    summary: "Reviewed 2000 changed file(s).",
    riskLevel: "high",
    findings: [...many("sensitive-files", "high"), ...many("sql-injection", "warning")]
  });

  const shown = markdown.match(/^#### High - /gm)?.length ?? 0;
  assert.ok(markdown.length <= 60_000, `${markdown.length} characters`);
  assert.ok(shown > 50 && shown < 1000, `${shown} findings shown`);
  assert.match(markdown, /^2000 findings in 2 areas: Review Scope \(1000\), Code \(1000\)\.$/m);
  assert.match(markdown, new RegExp(`^### Review Scope \\(${shown} of 1000 shown\\)$`, "m"));
  // The less severe area did not fit, so it is only in the overview.
  assert.doesNotMatch(markdown, /^### Code/m);
  assert.match(markdown, new RegExp(`^${2000 - shown} more finding\\(s\\) are not shown here`, "m"));
}

function finding(ruleId: string, severity: Severity, title: string): Finding {
  return { ruleId, title, severity, file: "src/app.ts", message: `${title}.` };
}
