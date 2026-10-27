import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { failingFindings } from "../../src/analysis/check-outcome.js";
import { defaultConfig } from "../../src/config/schema.js";
import type { Finding, SuppressedFinding } from "../../src/analysis/finding.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

// Assembled so this file does not suppress anything in its own pull request.
const ignore = ["prism-review", "ignore"].join("-");

export function testInlineSuppressionMovesAcknowledgedFindingsOut(): void {
  const result = analyzePullRequest(
    [
      file("app/reports.py", [
        `cursor.execute(f"SELECT * FROM {REPORT_TABLE} WHERE day = %s", (day,))  # ${ignore} sql-injection -- REPORT_TABLE is a module constant`
      ]),
      file("scripts/install.sh", [
        `# ${ignore} remote-script, risky-api: the installer is pinned by checksum in CI`,
        "curl -fsSL https://get.example.dev/install.sh | sh"
      ])
    ],
    defaultConfig
  );

  assert.deepEqual(result.findings.map((finding) => finding.ruleId), []);
  assert.deepEqual(
    result.suppressed?.map((finding) => [finding.ruleId, finding.file, finding.line, finding.suppressionReason]),
    [
      ["sql-injection", "app/reports.py", 1, "REPORT_TABLE is a module constant"],
      ["remote-script", "scripts/install.sh", 2, "the installer is pinned by checksum in CI"]
    ]
  );
  assert.equal(result.riskLevel, "low");
  assert.match(result.summary, /2 finding\(s\) were suppressed inline\.$/);
  assert.deepEqual(failingFindings(result, "warning"), []);
}

export function testInlineSuppressionNeedsEveryLineARuleAndAReason(): void {
  const result = analyzePullRequest(
    [
      // Only one of the two lines in the finding is acknowledged.
      file("app/a.py", [
        `cursor.execute(f"SELECT * FROM t WHERE id = {a}")  # ${ignore} sql-injection -- a is an int`,
        'cursor.execute(f"SELECT * FROM t WHERE id = {b}")'
      ]),
      // No reason.
      file("app/b.py", [`cursor.execute(f"SELECT * FROM t WHERE id = {a}")  # ${ignore} sql-injection`]),
      // Another rule.
      file("app/c.py", [`cursor.execute(f"SELECT * FROM t WHERE id = {a}")  # ${ignore} risky-api -- not this one`]),
      // A marker two lines above does not reach.
      file("app/d.py", [`# ${ignore} sql-injection -- too far`, "", 'cursor.execute(f"SELECT * FROM t WHERE id = {a}")'])
    ],
    defaultConfig
  );

  assert.deepEqual(
    result.findings.map((finding) => finding.file),
    ["app/a.py", "app/b.py", "app/c.py", "app/d.py"]
  );
  assert.deepEqual(result.suppressed, []);
}

export function testInlineSuppressionCannotHideSecurityRules(): void {
  // The rules that ignorePaths cannot hide cannot be suppressed inline either.
  const result = analyzePullRequest(
    [
      file(".env", [`DATABASE_PASSWORD=hunter2-prod  # ${ignore} credential-file -- it is fine`]),
      file(".github/workflows/ci.yml", [
        `      - uses: tj-actions/changed-files@v45  # ${ignore} unpinned-action -- trusted`
      ])
    ],
    defaultConfig
  );

  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId).sort(),
    ["credential-file", "sensitive-files", "unpinned-action"]
  );
  assert.deepEqual(result.suppressed, []);
}

export function testInlineSuppressionIsListedInTheComment(): void {
  const result = analyzePullRequest(
    [
      file("app/reports.py", [
        `cursor.execute(f"SELECT * FROM {T}")  # ${ignore} sql-injection -- see [docs](https://evil.example) ## Approved <b>`
      ])
    ],
    defaultConfig
  );

  const markdown = renderMarkdown(result);
  assert.match(markdown, /^### Suppressed Inline$/m);
  assert.match(
    markdown,
    /^- `sql-injection` on line 1 of `app\/reports\.py`: see \\\[docs\\\]\(https:\/\/evil\.example\) \\#\\# Approved \\<b\\>$/m
  );
  assert.doesNotMatch(markdown, /^## Approved/m);
}

export function testInlineSuppressionSharesTheCommentSizeLimit(): void {
  const finding = (index: number): Finding => ({
    ruleId: "sql-injection",
    title: "SQL built from values",
    severity: "warning",
    file: `src/${"nested/".repeat(30)}module-${index}.py`,
    line: 1,
    message: "Line 1 builds SQL from values inserted into the query text, which allows SQL injection unless every value is escaped.",
    recommendation: "Pass values as query parameters and keep the SQL text constant."
  });
  const suppressed: SuppressedFinding[] = Array.from({ length: 500 }, (_, index) => ({
    ...finding(index),
    suppressionReason: "x".repeat(200)
  }));
  const markdown = renderMarkdown({
    summary: "Reviewed 2500 changed file(s).",
    riskLevel: "medium",
    findings: Array.from({ length: 2000 }, (_, index) => finding(index)),
    suppressed
  });

  // GitHub rejects comments over 65536 characters, findings and suppressions together.
  assert.ok(markdown.length <= 60_000, `${markdown.length} characters`);
  assert.match(markdown, /^### Suppressed Inline$/m);
  assert.match(markdown, /^- \d+ more suppressed finding\(s\) are not shown\.$/m);
  assert.match(markdown, /### Suggested Review Checklist/);
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
