import assert from "node:assert/strict";
import type { Finding } from "../../src/analysis/finding.js";
import { planLineComments, type ExistingLineComment } from "../../src/github/line-comments.js";
import { renderLineComment } from "../../src/reporting/render-markdown.js";

const finding = (ruleId: string, file: string | undefined, line: number | undefined, severity: Finding["severity"] = "warning"): Finding => ({
  ruleId,
  title: `${ruleId} title`,
  severity,
  ...(file === undefined ? {} : { file }),
  ...(line === undefined ? {} : { line }),
  message: `${ruleId} message on ${line}`
});

const bot = { type: "Bot" };

export function testPlanLineCommentsCreatesUpdatesAndResolves(): void {
  const findings = [
    finding("sql-injection", "app/db.py", 4, "high"),
    finding("risky-api", "src/run.ts", 10),
    finding("remote-script", "Dockerfile", 2),
    finding("large-diff", undefined, undefined),
    finding("sensitive-files", "src/auth/a.ts", undefined, "high"),
    finding("blanket-suppression", "src/x.ts", 3, "info")
  ];
  const existing: ExistingLineComment[] = [
    // Same rule, file, and line: kept, or updated when the text changed.
    { id: 1, path: "app/db.py", line: 4, user: bot, body: renderLineComment(findings[0] as Finding) },
    { id: 2, path: "src/run.ts", line: 10, user: bot, body: "<!-- prism-review-line risky-api -->\nold text" },
    // No longer reported: marked resolved, never deleted.
    { id: 3, path: "src/old.ts", line: 7, user: bot, body: "<!-- prism-review-line risky-api -->\nold finding" },
    // Outdated comments have no current line, so they do not match.
    { id: 4, path: "Dockerfile", line: null, user: bot, body: "<!-- prism-review-line remote-script -->\nold" },
    // A person can paste the marker; only bot comments count.
    { id: 5, path: "app/db.py", line: 4, user: { type: "User" }, body: "<!-- prism-review-line sql-injection -->\nme" }
  ];

  const plan = planLineComments(findings, existing, { includeLowSeverity: false, maxComments: 25 });

  assert.deepEqual(
    plan.create.map((comment) => [comment.path, comment.line]),
    [["Dockerfile", 2]]
  );
  assert.deepEqual(plan.update.map((comment) => comment.id), [2]);
  assert.deepEqual(plan.resolve.map((comment) => comment.id), [3, 4]);
  assert.match(plan.update[0]?.body ?? "", /^<!-- prism-review-line risky-api -->\n\*\*Warning\*\* - risky-api title/);
  assert.match(plan.resolve[0]?.body ?? "", /^<!-- prism-review-line risky-api resolved -->\nThis finding is no longer reported/);
}

export function testPlanLineCommentsKeepsResolvedCommentsQuietAndCapsTheCount(): void {
  const resolved: ExistingLineComment = {
    id: 9,
    path: "src/old.ts",
    line: 7,
    user: bot,
    body: "<!-- prism-review-line risky-api resolved -->\nThis finding is no longer reported on the latest commit."
  };
  const many = Array.from({ length: 40 }, (_, index) => finding("risky-api", `src/f${index}.ts`, 1));

  const plan = planLineComments(many, [resolved], { includeLowSeverity: false, maxComments: 25 });

  assert.equal(plan.create.length, 25);
  assert.equal(plan.skipped, 15);
  assert.deepEqual(plan.resolve, []);

  // A resolved comment whose finding comes back is reactivated in place.
  const back = planLineComments([finding("risky-api", "src/old.ts", 7)], [resolved], { includeLowSeverity: false, maxComments: 25 });
  assert.deepEqual(back.update.map((comment) => comment.id), [9]);
  assert.deepEqual(back.create, []);
}

export function testRenderLineCommentEscapesFindingText(): void {
  const body = renderLineComment({
    ruleId: "sql-injection",
    title: "SQL <b>built</b>",
    severity: "high",
    file: "a.py",
    line: 1,
    message: "Values [here](https://evil.example)\n## Approved",
    recommendation: "Use `params`."
  });

  assert.equal(
    body,
    [
      "<!-- prism-review-line sql-injection -->",
      "**High** - SQL \\<b\\>built\\</b\\>",
      "",
      "Values \\[here\\](https://evil.example) \\#\\# Approved",
      "",
      "Recommendation: Use \\`params\\`."
    ].join("\n")
  );
}
