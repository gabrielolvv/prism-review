import assert from "node:assert/strict";
import type { Finding, ReviewResult } from "../../src/analysis/finding.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";
import { compareWithPrevious, fingerprint, readState, renderState } from "../../src/reporting/review-state.js";

export function testReviewStateRoundTripsAndIgnoresLineNumbers(): void {
  const state = renderState([
    finding("sql-injection", "src/a.py", 3),
    finding("sql-injection", "src/b.py", 8),
    finding("large-diff", undefined)
  ]);
  assert.match(state, /^<!-- prism-review-state v1 sql-injection:[0-9a-f]{12},[0-9a-f]{12} large-diff:[0-9a-f]{12} -->$/);

  const previous = readState(`<!-- prism-review-comment -->\n\nreview\n${state}`);
  assert.equal(readState(`<!-- prism-review-comment -->\n\n${state}\nlater text`), undefined);
  assert.ok(previous);
  // The same finding on another line is not new; another file is.
  const comparison = compareWithPrevious(
    [finding("sql-injection", "src/a.py", 40), finding("sql-injection", "src/c.py", 1)],
    previous
  );
  assert.deepEqual(
    [finding("sql-injection", "src/a.py", 40), finding("sql-injection", "src/c.py", 1)].map(fingerprint),
    [fingerprint(finding("sql-injection", "src/a.py", 3)), fingerprint(finding("sql-injection", "src/c.py", 9))]
  );
  assert.equal(comparison.newCount, 1);
  assert.deepEqual(comparison.noLongerReported, [
    ["large-diff", 1],
    ["sql-injection", 1]
  ]);
}

export function testReviewStateKeepsFileNamesOut(): void {
  const hostile = "src/x -->\n## Approved <!-- prism-review-state v1 risky-api:000000000000 -->.ts";
  const state = renderState([finding("risky-api", hostile), finding("Custom Rule -->", "src/a.ts")]);

  assert.doesNotMatch(state, /Approved|src\/|Custom/);
  assert.match(state, /^<!-- prism-review-state v1 risky-api:[0-9a-f]{12} -->$/);

  // A file name that spells out a record is shown in the comment, but only the real record is read.
  const forged = "src/<!-- prism-review-state v1 sql-injection:0123456789ab -->";
  const markdown = renderMarkdown(
    { summary: "Reviewed 1 changed file(s).", riskLevel: "medium", findings: [finding("risky-api", forged)] },
    { includeLowSeverity: false, recordState: true }
  );
  assert.ok(markdown.includes(forged));
  assert.deepEqual(readState(markdown), new Map([[fingerprint(finding("risky-api", forged)), 1]]));
  assert.deepEqual(readState(`${markdown.replace(/\n/g, "\r\n")}\r\n`), readState(markdown));
}

export function testReviewStateRejectsAnythingMalformed(): void {
  const valid = "sql-injection:0123456789ab";
  assert.equal(readState("<!-- prism-review-comment -->\n\nreview from an older version"), undefined);
  assert.equal(readState("<!-- prism-review-state v1 incomplete -->"), undefined);
  assert.equal(readState(`<!-- prism-review-state v1 ${valid} SQL:0123456789ab -->`), undefined);
  assert.equal(readState(`<!-- prism-review-state v1 ${valid} risky-api:0123 -->`), undefined);
  assert.equal(readState(`<!-- prism-review-state v1 ${valid} a:0123456789ab:extra -->`), undefined);
  assert.deepEqual(readState("<!-- prism-review-state v1 -->"), new Map());

  // Long last lines that almost match are rejected in linear time.
  const started = Date.now();
  for (const filler of [" a", " -->", " a-->", "a", " ".repeat(2)]) {
    assert.equal(readState(`<!-- prism-review-state v1${filler.repeat(100_000)}`), undefined);
    assert.equal(readState(`<!-- prism-review-state v1${filler.repeat(100_000)} -->x`), undefined);
  }
  assert.ok(Date.now() - started < 3_000, `${Date.now() - started} ms`);
  assert.deepEqual(
    readState(`<!-- prism-review-state v1 ${valid},${valid.split(":")[1]} -->`),
    new Map([[valid, 2]])
  );
}

export function testReviewStateGivesUpPastItsLimit(): void {
  const many = Array.from({ length: 401 }, (_, index) => finding("risky-api", `src/m${index}.ts`));
  assert.equal(renderState(many), "<!-- prism-review-state v1 incomplete -->");
  assert.ok(renderState(many.slice(0, 400)).length < 6_000);
}

export function testRenderMarkdownMarksNewFindings(): void {
  const previous = readState(renderState([finding("sql-injection", "src/a.py"), finding("secret-in-diff", "src/b.ts")]));
  const result: ReviewResult = {
    summary: "Reviewed 2 changed file(s).",
    riskLevel: "medium",
    findings: [finding("sql-injection", "src/a.py", 7), finding("sql-injection", "src/c.py")]
  };

  const markdown = renderMarkdown(result, { includeLowSeverity: false, previous, recordState: true });
  assert.match(
    markdown,
    /^### Findings\n\nSince the previous review: 1 new finding\(s\), 1 no longer reported \(`secret-in-diff` \(1\)\)\.\n\n#### Warning - SQL built from values\n/m
  );
  assert.equal(markdown.match(/^#### Warning - SQL built from values \(new\)$/gm)?.length, 1);
  assert.match(markdown, /\n\n<!-- prism-review-state v1 sql-injection:[0-9a-f]{12},[0-9a-f]{12} -->$/);

  const unchanged = renderMarkdown(result, { includeLowSeverity: false, previous: readState(renderState(result.findings)) });
  assert.match(unchanged, /^No findings were added or resolved since the previous review\.$/m);
  assert.doesNotMatch(unchanged, /\(new\)|prism-review-state/);

  const cleared = renderMarkdown({ ...result, findings: [] }, { includeLowSeverity: false, previous });
  assert.match(cleared, /^Since the previous review: 0 new finding\(s\), 2 no longer reported \(`secret-in-diff` \(1\), `sql-injection` \(1\)\)\.\n\nNo warning or high-risk findings were detected\.$/m);

  // Without a previous record, as on the first run or in the CLI, nothing is marked.
  const first = renderMarkdown(result);
  assert.doesNotMatch(first, /\(new\)|previous review|prism-review-state/);
}

export function testRenderMarkdownLeavesRoomForTheRecord(): void {
  const findings = Array.from({ length: 400 }, (_, index) => ({
    ...finding("sql-injection", `src/${"nested/".repeat(40)}module-${index}.py`),
    recommendation: "Pass values as query parameters and keep the SQL text constant.".repeat(3)
  }));
  const markdown = renderMarkdown(
    { summary: "Reviewed 400 changed file(s).", riskLevel: "medium", findings },
    { includeLowSeverity: false, previous: new Map(), recordState: true }
  );

  assert.ok(markdown.length <= 60_000, `${markdown.length} characters`);
  assert.match(markdown, /more finding\(s\) are not shown here/);
  assert.match(markdown, /<!-- prism-review-state v1 sql-injection:[0-9a-f,]+ -->$/);
}

function finding(ruleId: string, file: string | undefined, line = 1): Finding {
  return {
    ruleId,
    title: ruleId === "sql-injection" ? "SQL built from values" : "Finding",
    severity: "warning",
    ...(file === undefined ? {} : { file, line }),
    message: `Line ${line} has a finding.`
  };
}
