import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ReviewResult } from "../../src/analysis/finding.js";
import { defaultConfig } from "../../src/config/schema.js";
import { PRISM_COMMENT_MARKER, renderMarkdown } from "../../src/reporting/render-markdown.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testRenderMarkdown(): void {
  const result = analyzePullRequest(
    loadDiffFixture("fixtures/diffs/risky-auth-change.diff"),
    defaultConfig
  );

  const markdown = renderMarkdown(result);

  assert.match(markdown, new RegExp(PRISM_COMMENT_MARKER));
  assert.match(markdown, /## Prism Review/);
  assert.match(markdown, /### Findings/);
  assert.match(markdown, /### Suggested Review Checklist/);
}

export function testRenderMarkdownHidesLowSeverityByDefault(): void {
  const markdown = renderMarkdown(resultWithInfoFinding());

  assert.doesNotMatch(markdown, /Generated file changed/);
  assert.match(markdown, /No warning or high-risk findings were detected\./);
}

export function testRenderMarkdownIncludesLowSeverityWhenEnabled(): void {
  const markdown = renderMarkdown(resultWithInfoFinding(), { includeLowSeverity: true });

  assert.match(markdown, /#### Info - Generated file changed/);
  assert.doesNotMatch(markdown, /No warning or high-risk findings were detected\./);
}

function resultWithInfoFinding(): ReviewResult {
  return {
    summary: "Reviewed 1 changed file(s).",
    riskLevel: "low",
    findings: [
      {
        ruleId: "example-info",
        title: "Generated file changed",
        severity: "info",
        file: "dist/action/index.cjs",
        message: "dist/action/index.cjs is generated output."
      }
    ]
  };
}
