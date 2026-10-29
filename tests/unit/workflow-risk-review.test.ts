import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testWorkflowRiskRuleTreatsEveryMappingValueAsData(): void {
  const findings = workflowFindings([
    file(".github/workflows/safe.yml", [
      "run-name: Deploy ${{ github.event.pull_request.title }}",
      "on: issues",
      "jobs:",
      "  triage:",
      "    steps:",
      "      - name: Triage ${{ github.event.issue.title }}",
      '        env: { TITLE: "${{ github.event.issue.title }}" }',
      '        run: echo "$TITLE"',
      "      - uses: actions/github-script@v7",
      "        with:",
      "          title: 'PR: ${{ github.event.pull_request.title }}'",
      "          body: |",
      "            ${{ github.event.issue.body }}",
      "      - if: github.event_name != 'pull_request_target'",
      "        run: echo skipping",
      "# pull_request_target is not used here"
    ])
  ]);

  assert.deepEqual(findings, []);
}

export function testWorkflowRiskRuleReadsScriptBlocks(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/notes.yml", [
      "jobs:",
      "  notes:",
      "    steps:",
      "      - run: |",
      "          cat > notes.yml <<EOF",
      "          title: ${{ github.event.issue.title }}",
      "          EOF",
      "      - uses: actions/github-script@v7",
      "        with:",
      "          script: |",
      "            const body = `${{ github.event.comment.body }}`;",
      "      - name: after the block",
      "        env:",
      "          SAFE: ${{ github.event.issue.body }}"
    ])
  ]);

  assert.equal(finding?.severity, "high");
  assert.match(finding?.message ?? "", /^Lines 6, 11 add risky workflow configuration: untrusted input in a script \(github\.event\.issue\.title, github\.event\.comment\.body\)\.$/);
}

export function testWorkflowRiskRuleReadsScriptBlocksThatStartBeforeTheHunk(): void {
  // Context lines in the patch show that the added line is inside a run block.
  const patch = [
    "@@ -10,4 +10,5 @@ jobs:",
    "       - run: |",
    "           echo start",
    "+          title: ${{ github.event.issue.title }}",
    "           echo end",
    "       - name: next"
  ].join("\n");

  const [finding] = workflowFindings([{ path: ".github/workflows/ci.yml", status: "modified", additions: 1, deletions: 0, patch }]);

  assert.equal(finding?.line, 12);
  assert.equal(finding?.severity, "high");
}

export function testWorkflowRiskRuleSeesThroughBracketsFormatAndToJson(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/evasion.yml", [
      "jobs:",
      "  x:",
      "    steps:",
      `      - run: echo "\${{ github.event['issue']['title'] }}"`,
      "      - run: echo '${{ toJSON(github.event.pull_request) }}'",
      "      - run: echo \"${{ format('Issue {0}', github.event.issue.body) }}\"",
      "      - run: echo ${{ github.event.pull_request.number }} ${{ github.sha }}"
    ])
  ]);

  assert.match(
    finding?.message ?? "",
    /^Lines 4, 5, 6 add risky workflow configuration: untrusted input in a script \(github\.event\.issue\.title, github\.event\.pull_request, github\.event\.issue\.body\)\.$/
  );
}

export function testWorkflowRiskRuleIgnoresIgnorePaths(): void {
  const config = prismConfigSchema.parse({ ignorePaths: ["**/*.yml"] });
  const files = [file(".github/workflows/x.yml", ["      - run: echo ${{ github.head_ref }}"])];

  assert.ok(analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "workflow-risk"));
}

export function testWorkflowRiskRuleReportsTriggersOnly(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/target.yml", ["on: [push, pull_request_target]", "on:", "  pull_request_target:", "    types: [opened]"])
  ]);

  assert.equal(finding?.message, "Lines 1, 3 add risky workflow configuration: pull_request_target trigger.");
}

function workflowFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "workflow-risk");
}

// Lines added to an existing workflow, whose permissions may be set outside the diff.
function file(path: string, lines: string[], status: ChangedFile["status"] = "modified"): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status, additions: lines.length, deletions: 0, patch };
}
