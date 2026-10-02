import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
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

export function testRenderMarkdownKeepsHostilePathsInert(): void {
  // Git allows these characters in file names, and the pull request files API returns them as-is.
  const paths = [
    "src/auth/a`\n\n## Prism Review\n\nRisk level: **Low**\n\n`b.ts",
    "src/auth/x\r\n<!-- prism-review-comment -->\n<!--.ts",
    "src/auth/@acme/security-team #12 [link](https://example.com).ts",
    "src/auth/z.ts\n- [x] Reviewed by security"
  ];
  const files: ChangedFile[] = paths.map((path) => ({
    path,
    status: "modified",
    additions: 1,
    deletions: 0
  }));

  const result = analyzePullRequest(files, defaultConfig);
  const markdown = renderMarkdown(result);
  const lines = markdown.split("\n");

  assert.ok(result.findings.length >= paths.length);
  for (const finding of result.findings) {
    assert.ok(!paths.some((path) => finding.message.includes(path)), finding.message);
  }

  assert.deepEqual(
    lines.filter((line) => line.startsWith("#")),
    [
      "## Prism Review",
      "### Summary",
      "### Findings",
      ...result.findings.map((finding) => `#### ${finding.severity === "high" ? "High" : "Warning"} - ${finding.title}`),
      "### Suggested Review Checklist"
    ]
  );
  assert.equal(lines.filter((line) => line.startsWith("Risk level:")).length, 1);
  assert.equal(lines[0], PRISM_COMMENT_MARKER);
  assert.ok(lines.slice(1).every((line) => !line.includes("<!--") || line.startsWith("File: ")));
  assert.ok(!lines.some((line) => line.startsWith("- [x]")));

  // Every path is shown once, with newlines spelled out, on a File: line inside a code span.
  for (const path of paths) {
    const shown = path.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    const matching = lines.filter((line) => line.includes(shown));
    assert.equal(matching.length, 1, path);
    assert.match(matching[0] ?? "", /^File: (`+) ?.+ ?\1$/);
  }
}

export function testRenderMarkdownFencesBackticksInPaths(): void {
  const render = (file: string) =>
    renderMarkdown({
      summary: "Reviewed 1 changed file(s).",
      riskLevel: "high",
      findings: [{ ruleId: "test", title: "Finding", severity: "high", file, message: "Check it." }]
    })
      .split("\n")
      .find((line) => line.startsWith("File: "));

  assert.equal(render("src/plain.ts"), "File: `src/plain.ts`");
  assert.equal(render("src/a``b.ts"), "File: ```src/a``b.ts```");
  assert.equal(render("`quoted`.ts"), "File: `` `quoted`.ts ``");
}

export function testRenderMarkdownEscapesFindingText(): void {
  const markdown = renderMarkdown({
    summary: "Reviewed 1 changed file(s).",
    riskLevel: "high",
    findings: [
      {
        ruleId: "custom",
        title: "Custom <b>rule</b>",
        severity: "high",
        message: "Avoid *emphasis* and [links](https://example.com)\n## or headings.",
        recommendation: "Keep `code` and | pipes | literal."
      }
    ]
  });

  assert.match(markdown, /^#### High - Custom \\<b\\>rule\\<\/b\\>$/m);
  assert.match(
    markdown,
    /^Avoid \\\*emphasis\\\* and \\\[links\\\]\(https:\/\/example\.com\) \\#\\# or headings\.$/m
  );
  assert.match(markdown, /^Recommendation: Keep \\`code\\` and \\\| pipes \\\| literal\.$/m);
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
