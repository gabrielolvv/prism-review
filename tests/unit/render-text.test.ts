import assert from "node:assert/strict";
import type { ReviewResult } from "../../src/analysis/finding.js";
import { renderText } from "../../src/reporting/render-text.js";

const result: ReviewResult = {
  summary: "Reviewed 3 changed file(s). Found 1 high-risk and 2 warning-level signal(s).",
  riskLevel: "high",
  findings: [
    { ruleId: "missing-tests", title: "Source changed without tests", severity: "warning", message: "No test files changed." },
    { ruleId: "sql-injection", title: "SQL built from values", severity: "warning", file: "src/db.ts", line: 9, message: "Line 9 builds SQL." },
    { ruleId: "secret-in-diff", title: "Possible secret added", severity: "high", file: "src/config.ts", line: 2, message: "Line 2 adds a key." },
    { ruleId: "oversized-patch", title: "Patch too large to inspect", severity: "info", file: "dist/app.js", message: "Too large." }
  ],
  dependencyChanges: [{ file: "package.json", ecosystem: "npm", name: "left-pad", to: "1.3.0" }]
};

export function testRenderTextListsFindingsBySeverity(): void {
  assert.equal(
    renderText(result, { includeLowSeverity: false, color: false }),
    [
      "Prism Review: high risk. Reviewed 3 changed file(s). Found 1 high-risk and 2 warning-level signal(s).",
      "",
      "high     src/config.ts:2  Possible secret added [secret-in-diff]",
      "         Line 2 adds a key.",
      "warning  Source changed without tests [missing-tests]",
      "         No test files changed.",
      "warning  src/db.ts:9  SQL built from values [sql-injection]",
      "         Line 9 builds SQL.",
      "",
      "1 dependency change(s). Use --format markdown for recommendations and the reviewer checklist."
    ].join("\n")
  );
}

export function testRenderTextShowsInfoFindingsWhenAsked(): void {
  const text = renderText(result, { includeLowSeverity: true, color: false });

  assert.match(text, /^info {5}dist\/app\.js  Patch too large to inspect \[oversized-patch\]$/m);
}

export function testRenderTextColorsOnlyWhenAsked(): void {
  const escape = String.fromCharCode(27);

  assert.ok(!renderText(result, { includeLowSeverity: false, color: false }).includes(escape));
  const colored = renderText(result, { includeLowSeverity: false, color: true });
  assert.ok(colored.includes(`${escape}[1;31mhigh   ${escape}[0m`));
  assert.ok(colored.includes(`${escape}[33mwarning${escape}[0m`));
}

export function testRenderTextShowsControlCharactersFromThePullRequest(): void {
  // A file name or title with an escape sequence could clear the screen or rewrite earlier lines.
  const escape = String.fromCharCode(27);
  const rightToLeft = String.fromCodePoint(0x202e);
  const hostile: ReviewResult = {
    summary: "Reviewed 1 changed file(s).",
    riskLevel: "medium",
    findings: [
      {
        ruleId: "sensitive-files",
        title: "Sensitive file changed",
        severity: "warning",
        file: `src/${escape}[2Jauth${rightToLeft}.ts`,
        message: `First line\nsecond line${String.fromCharCode(7)}`
      }
    ]
  };

  const text = renderText(hostile, { includeLowSeverity: false, color: false });
  assert.ok(!text.includes(escape));
  assert.match(text, /src\/\\u\{1B\}\[2Jauth\\u\{202E\}\.ts {2}Sensitive file changed/);
  assert.match(text, /First line second line\\u\{7\}$/m);
}

export function testRenderTextWithoutFindings(): void {
  const clean: ReviewResult = { summary: "Reviewed 2 changed file(s). No risk signals found.", riskLevel: "low", findings: [] };

  assert.equal(
    renderText(clean, { includeLowSeverity: false, color: false }),
    "Prism Review: low risk. Reviewed 2 changed file(s). No risk signals found."
  );
}
