import assert from "node:assert/strict";
import type { ReviewResult } from "../../src/analysis/finding.js";
import { renderJson } from "../../src/reporting/render-json.js";
import { renderSarif } from "../../src/reporting/render-sarif.js";
import { defaultRules } from "../../src/rules/index.js";

const result: ReviewResult = {
  summary: "Reviewed 3 changed file(s). Found 1 high-risk and 1 warning-level signal(s). 1 finding(s) were suppressed inline.",
  riskLevel: "high",
  findings: [
    {
      ruleId: "sql-injection",
      title: "SQL built from values",
      severity: "high",
      file: "src/my reports#1.ts",
      line: 4,
      lines: [4, 9],
      message: "Lines 4, 9 build SQL from values.",
      recommendation: "Pass values as query parameters."
    },
    { ruleId: "large-diff", title: "Large pull request", severity: "warning", message: "This PR changes 40 file(s)." },
    { ruleId: "sensitive-files", title: "Sensitive file changed", severity: "info", file: "src/auth/session.ts", message: "Touches auth." }
  ],
  suppressed: [
    {
      ruleId: "remote-script",
      title: "Downloaded script runs unchecked",
      severity: "warning",
      file: "install.sh",
      line: 2,
      message: "Line 2 runs a script.",
      suppressionReason: "pinned by checksum"
    }
  ]
};

export function testRenderJsonKeepsEveryField(): void {
  const json = JSON.parse(renderJson(result));

  assert.equal(json.riskLevel, "high");
  assert.deepEqual(json.counts, { high: 1, warning: 1, info: 1, suppressed: 1 });
  assert.deepEqual(json.findings[0], {
    ruleId: "sql-injection",
    area: "code",
    severity: "high",
    title: "SQL built from values",
    message: "Lines 4, 9 build SQL from values.",
    recommendation: "Pass values as query parameters.",
    file: "src/my reports#1.ts",
    line: 4,
    lines: [4, 9]
  });
  assert.equal(json.findings[1].file, undefined);
  assert.equal(json.findings[1].area, "review-scope");
  assert.deepEqual(json.suppressed.map((finding: { ruleId: string; reason: string }) => [finding.ruleId, finding.reason]), [
    ["remote-script", "pinned by checksum"]
  ]);
}

export function testRenderSarifMapsFindingsForCodeScanning(): void {
  const sarif = JSON.parse(renderSarif(result, defaultRules));
  const run = sarif.runs[0];

  assert.equal(sarif.version, "2.1.0");
  assert.equal(run.tool.driver.name, "Prism Review");
  assert.deepEqual(
    run.tool.driver.rules.map((rule: { id: string }) => rule.id),
    defaultRules.map((rule) => rule.id)
  );
  const tags = new Map(
    run.tool.driver.rules.map((rule: { id: string; properties: { tags: string[] } }) => [rule.id, rule.properties.tags])
  );
  assert.deepEqual(tags.get("secret-in-diff"), ["secrets"]);
  assert.deepEqual(tags.get("unpinned-action"), ["supply-chain"]);

  // Findings without a file, such as large-diff, cannot be placed for code scanning.
  assert.deepEqual(
    run.results.map((entry: { ruleId: string; level: string }) => [entry.ruleId, entry.level]),
    [
      ["sql-injection", "error"],
      ["sensitive-files", "note"],
      ["remote-script", "warning"]
    ]
  );
  assert.deepEqual(run.results[0].locations[0].physicalLocation, {
    artifactLocation: { uri: "src/my%20reports%231.ts" },
    region: { startLine: 4 }
  });
  assert.equal(run.results[0].message.text, "Lines 4, 9 build SQL from values. Pass values as query parameters.");
  assert.equal(run.results[1].locations[0].physicalLocation.region, undefined);
  assert.equal(run.results[0].suppressions, undefined);
  assert.deepEqual(run.results[2].suppressions, [{ kind: "inSource", justification: "pinned by checksum" }]);
}
