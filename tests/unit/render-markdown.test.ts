import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
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
