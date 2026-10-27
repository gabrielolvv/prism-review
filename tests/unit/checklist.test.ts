import assert from "node:assert/strict";
import type { Finding } from "../../src/analysis/finding.js";
import type { Severity } from "../../src/analysis/severity.js";
import { prismConfigSchema } from "../../src/config/schema.js";
import { checklistQuestions, defaultQuestions, ruleQuestions } from "../../src/reporting/checklist.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";
import { ruleIds } from "../../src/rules/ids.js";

export function testEveryRuleHasAChecklistQuestion(): void {
  assert.deepEqual(Object.keys(ruleQuestions).sort(), [...ruleIds].sort());
  assert.equal(new Set(Object.values(ruleQuestions)).size, ruleIds.length);
}

export function testChecklistAsksAboutTheFindings(): void {
  const markdown = renderMarkdown({
    summary: "Reviewed 3 changed file(s).",
    riskLevel: "high",
    findings: [
      finding("secret-in-diff", "high"),
      finding("destructive-migration", "high"),
      finding("sql-injection", "warning"),
      finding("sql-injection", "warning"),
      finding("custom-rule", "warning")
    ]
  });

  assert.deepEqual(checklist(markdown), [
    ruleQuestions["secret-in-diff"],
    ruleQuestions["destructive-migration"],
    ruleQuestions["sql-injection"]
  ]);
}

export function testChecklistFallsBackToGeneralQuestions(): void {
  const empty = renderMarkdown({ summary: "Reviewed 1 changed file(s).", riskLevel: "low", findings: [] });
  assert.deepEqual(checklist(empty), defaultQuestions);

  // Info findings are hidden by default, so they do not pick the questions either.
  assert.deepEqual(checklistQuestions([finding("custom-rule", "warning")]), defaultQuestions);
  const hidden = renderMarkdown({
    summary: "Reviewed 1 changed file(s).",
    riskLevel: "low",
    findings: [finding("oversized-patch", "info")]
  });
  assert.deepEqual(checklist(hidden), defaultQuestions);

  const many = ruleIds.map((ruleId) => finding(ruleId, "warning"));
  assert.equal(checklistQuestions(many).length, 8);
}

export function testChecklistAddsTheRepositoryQuestions(): void {
  const config = prismConfigSchema.parse({
    comment: { checklist: ["  Is the CHANGELOG updated?  ", "Did <b>QA</b> sign off in [the tracker](https://example.com)?"] }
  });
  const markdown = renderMarkdown(
    { summary: "Reviewed 1 changed file(s).", riskLevel: "medium", findings: [finding("missing-tests", "warning")] },
    config.comment
  );

  assert.deepEqual(checklist(markdown), [
    ruleQuestions["missing-tests"],
    "Is the CHANGELOG updated?",
    "Did \\<b\\>QA\\</b\\> sign off in \\[the tracker\\](https://example.com)?"
  ]);

  for (const checklist of [[""], Array.from({ length: 11 }, () => "Question?"), ["x".repeat(301)]]) {
    assert.throws(() => prismConfigSchema.parse({ comment: { checklist } }));
  }
}

export function testChecklistSharesTheCommentSizeLimit(): void {
  const markdown = renderMarkdown(
    {
      summary: "Reviewed 2000 changed file(s).",
      riskLevel: "high",
      findings: Array.from({ length: 2000 }, (_, index) => ({
        ...finding(ruleIds[index % ruleIds.length] ?? "risky-api", "high"),
        file: `src/${"nested/".repeat(30)}module-${index}.ts`
      }))
    },
    { includeLowSeverity: false, checklist: Array.from({ length: 10 }, (_, index) => `${index} ${"x".repeat(290)}?`) }
  );

  assert.ok(markdown.length <= 60_000, `${markdown.length} characters`);
  assert.equal(checklist(markdown).length, 18);
}

function checklist(markdown: string): string[] {
  return markdown
    .slice(markdown.indexOf("### Suggested Review Checklist"))
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function finding(ruleId: string, severity: Severity): Finding {
  return { ruleId, title: "Finding", severity, file: "src/app.ts", message: "Check it." };
}
