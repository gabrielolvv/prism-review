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

export function testWorkflowRiskReportsTopLevelWritePermissions(): void {
  const [finding] = workflowFindings([
    file(".github/workflows/release.yml", [
      "on: push",
      "permissions:",
      "  contents: write",
      "  id-token: write",
      "  pull-requests: read",
      "jobs:",
      "  publish:",
      "    permissions:",
      "      packages: write",
      "    runs-on: ubuntu-latest"
    ])
  ]);

  // Job-level writes are where they belong; only the workflow-wide ones are reported.
  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [3, 4]);
  assert.equal(finding?.message, "Lines 3, 4 add risky workflow configuration: write permissions for every job (contents, id-token).");

  // The inline form, and a hunk that starts inside the top-level block, which git names in its context.
  const inline = workflowFindings([file(".github/workflows/a.yml", ["permissions: { contents: write, issues: read }"])]);
  assert.match(inline[0]?.message ?? "", /write permissions for every job \(contents\)/);
  const inside: ChangedFile = {
    path: ".github/workflows/b.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: "@@ -3,2 +3,3 @@ permissions:\n   contents: read\n+  id-token: write\n jobs:"
  };
  assert.deepEqual(workflowFindings([inside])[0]?.lines, [4]);

  // Read-only and empty top-level permissions, and composite actions, are not reported.
  assert.deepEqual(workflowFindings([file(".github/workflows/c.yml", ["permissions:", "  contents: read", "permissions: {}"])]), []);
  assert.deepEqual(workflowFindings([file("action.yml", ["permissions:", "  contents: write"])]), []);
}

export function testWorkflowRiskReportsNewWorkflowsWithoutPermissions(): void {
  const lines = ["on: push", "jobs:", "  test:", "    runs-on: ubuntu-latest", "    steps:", "      - run: npm test"];

  const [finding] = workflowFindings([file(".github/workflows/ci.yml", lines, "added")]);
  assert.deepEqual(finding?.lines, [1]);
  assert.match(finding?.message ?? "", /a new workflow that sets no permissions, so its jobs get the repository's default token permissions/);

  // An existing workflow may set them outside the diff; a job-level key and a reusable workflow count as set.
  assert.deepEqual(workflowFindings([file(".github/workflows/ci.yml", lines)]), []);
  assert.deepEqual(workflowFindings([file(".github/workflows/ci.yml", [...lines, "    permissions:", "      contents: read"], "added")]), []);
  assert.deepEqual(workflowFindings([file(".github/workflows/reusable.yml", ["on:", "  workflow_call:", ...lines.slice(1)], "added")]), []);
}

function workflowFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "workflow-risk");
}

// Lines added to an existing workflow, whose permissions may be set outside the diff.
function file(path: string, lines: string[], status: ChangedFile["status"] = "modified"): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status, additions: lines.length, deletions: 0, patch };
}
