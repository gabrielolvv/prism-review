import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import type { Finding, ReviewResult } from "../../src/analysis/finding.js";
import { parseConfig } from "../../src/config/load-config.js";
import { ruleIds } from "../../src/rules/ids.js";
import { defaultRules } from "../../src/rules/index.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

export function testLargeDiffOffAlsoSkipsTheSizeCheck(): void {
  const config = parseConfig("risk:\n  largeDiff:\n    maxFiles: 1\nseverity:\n  large-diff: off\n", "test");
  const files = [changed("docs/a.md"), changed("docs/b.md")];

  const result = analyzePullRequest(files, config);

  assert.deepEqual(result.findings, []);
  assert.equal(result.riskLevel, "low");
}

export function testIgnorePathsMatchDotfilesAndRenames(): void {
  const config = parseConfig(
    ["ignorePaths:", '  - "dist/**"', '  - "vendor/**"', '  - "**/*.yml"', "risk:", "  largeDiff:", "    maxFiles: 100", ""].join("\n"),
    "test"
  );
  const files = [
    changed("dist/.cache/bundle.js"),
    changed(".github/settings.yml"),
    // Moved out of a reviewed directory into an ignored one: still reviewed.
    { ...changed("vendor/session.ts"), status: "renamed" as const, previousPath: "src/auth/session.ts" },
    { ...changed("vendor/lib/old.js"), status: "renamed" as const, previousPath: "vendor/old.js" }
  ];

  const result = analyzePullRequest(files, config);

  assert.equal(result.summary.split(".")[0], "Reviewed 1 changed file(s), 3 more ignored by ignorePaths");
  assert.deepEqual(
    result.findings.filter((finding) => finding.ruleId === "sensitive-files").map((finding) => finding.file),
    ["vendor/session.ts"]
  );
}

export function testRuleIdListMatchesTheRegisteredRules(): void {
  assert.deepEqual([...ruleIds].sort(), defaultRules.map((rule) => rule.id).sort());
}

export function testRenderMarkdownCapsTheCommentLength(): void {
  const findings: Finding[] = Array.from({ length: 2000 }, (_, index) => ({
    ruleId: "sensitive-files",
    title: "Sensitive file changed",
    severity: "high",
    file: `src/auth/module-${index}/handler.ts`,
    message: "This file touches an area that commonly affects security, deployment, data integrity, or access control.",
    recommendation: "Ask for focused review from someone familiar with this area and verify rollback or mitigation steps."
  }));
  const result: ReviewResult = { summary: "Reviewed 2000 changed file(s).", riskLevel: "high", findings };

  const markdown = renderMarkdown(result);
  const shown = markdown.match(/^#### High - /gm)?.length ?? 0;

  // GitHub rejects comments over 65536 characters.
  assert.ok(markdown.length <= 60_000, `${markdown.length} characters`);
  assert.ok(shown > 50 && shown < 2000, `${shown} findings shown`);
  assert.match(markdown, new RegExp(`^${2000 - shown} more finding\\(s\\) are not shown here`, "m"));
  assert.match(markdown, /### Suggested Review Checklist/);
}

function changed(path: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 0 };
}
