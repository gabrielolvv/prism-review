import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testWorkflowRiskRuleReportsScriptInjectionAsHigh(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/triage.yml", [
      "on: issues",
      "jobs:",
      "  label:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      '      - run: echo "New issue: ${{ github.event.issue.title }}"',
      "      - run: |",
      "          git checkout ${{ github.head_ref }}"
    ])
  ]);

  assert.equal(finding?.severity, "high");
  assert.equal(finding?.line, 6);
  assert.equal(
    finding?.message,
    "Lines 6, 8 add risky workflow configuration: untrusted input in a script (github.event.issue.title, github.head_ref)."
  );
}

export function testWorkflowRiskRuleReportsRiskyTriggersAndPermissions(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/preview.yaml", [
      "on:",
      "  pull_request_target:",
      "permissions: write-all",
      "jobs:",
      "  build:",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "        with:",
      "          ref: ${{ github.event.pull_request.head.sha }}"
    ])
  ]);

  assert.equal(finding?.severity, "warning");
  assert.equal(
    finding?.message,
    "Lines 2, 3, 9 add risky workflow configuration: pull_request_target trigger, write-all permissions, checkout of pull request code."
  );
}

export function testWorkflowRiskRuleIgnoresSafePatterns(): void {
  const findings = workflowFindings([
    file(".github/workflows/safe.yml", [
      "on: [pull_request]",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  greet:",
      "    if: ${{ github.event.issue.title != '' }}",
      "    steps:",
      "      - env:",
      "          TITLE: ${{ github.event.issue.title }}",
      '        run: echo "$TITLE"',
      "      - uses: actions/labeler@v5",
      "        with:",
      "          title: ${{ github.event.pull_request.title }}",
      "      - run: echo ${{ github.event.pull_request.number }}"
    ]),
    // Only workflow and action files are checked.
    file("docs/ci.md", ['run: echo "${{ github.event.issue.title }}"'])
  ]);

  assert.deepEqual(findings, []);
}

export function testWorkflowRiskRuleChecksCompositeActionsAndCanBeDisabled(): void {
  const action = file("actions/notify/action.yml", [
    "runs:",
    "  using: composite",
    "  steps:",
    '    - run: echo "${{ github.event.comment.body }}"',
    "      shell: bash"
  ]);

  assert.equal(workflowFindings([action])[0]?.line, 4);

  const config = prismConfigSchema.parse({ rules: { workflowRisk: { enabled: false } } });
  assert.ok(!analyzePullRequest([action], config).findings.some((finding) => finding.ruleId === "workflow-risk"));
}

function workflowFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "workflow-risk");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
