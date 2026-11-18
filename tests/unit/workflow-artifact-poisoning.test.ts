import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { workflowArtifactPoisoningRule } from "../../src/rules/workflow-artifact-poisoning.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return workflowArtifactPoisoningRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const workflow = (condition: string[], ...steps: string[]) => [
  "name: Comment on PR",
  "on:",
  "  workflow_run:",
  "    workflows: [CI]",
  "    types: [completed]",
  "jobs:",
  "  comment:",
  ...condition.map((line) => `    ${line}`),
  "    runs-on: ubuntu-latest",
  "    steps:",
  ...steps.map((line) => `      ${line}`)
];
const checkout = ["- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd"];
const download = (...extra: string[]) => [
  "- name: Download results",
  "  uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  "  with:",
  "    run-id: ${{ github.event.workflow_run.id }}",
  "    github-token: ${{ github.token }}",
  ...extra.map((line) => `    ${line}`)
];

export function testWorkflowArtifactPoisoningReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added(".github/workflows/comment.yml", workflow([], ...checkout, ...download(), "- run: python scripts/comment.py"))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Untrusted artifacts unpacked over the workspace");
  assert.deepEqual(finding?.lines, [11]);
  assert.equal(
    finding?.message,
    "Line 11 unpacks artifacts of the run that triggered this `workflow_run` workflow into the workspace. A pull request from a fork can fill those artifacts, and their files can replace the checked-out code, which later steps run with this workflow's secrets and write token."
  );

  const [warning] = findings([added(".github/workflows/comment.yml", workflow([], ...checkout, ...download("path: ."), "- uses: actions/github-script@v7"))]);
  assert.equal(warning?.severity, "warning");
}

export function testWorkflowArtifactPoisoningReadsEachDownload(): void {
  const cases: string[][] = [
    // A third-party download action, with no path.
    workflow([], ...checkout, "- uses: dawidd6/action-download-artifact@v6", "  with:", "    workflow: ci.yml", "- run: make report"),
    // The GitHub CLI, without a directory.
    workflow([], ...checkout, "- run: gh run download ${{ github.event.workflow_run.id }} --name results", "- run: ./scripts/post.sh"),
    // The REST API and unzip into the workspace.
    workflow(
      [],
      ...checkout,
      "- uses: actions/github-script@v7",
      "  with:",
      "    script: |",
      "      const download = await github.rest.actions.downloadArtifact({ owner, repo, artifact_id, archive_format: 'zip' });",
      "- run: unzip -o pr.zip",
      "- run: npm run comment"
    ),
    // The workspace named as the path.
    workflow([], ...checkout, ...download("path: ${{ github.workspace }}"), "- uses: ./.github/actions/comment")
  ];
  for (const lines of cases) {
    assert.equal(findings([added(".github/workflows/comment.yml", lines)]).length, 1, lines.join(" | "));
  }
}

export function testWorkflowArtifactPoisoningSkipsSeparateDirectoriesAndTrustedRuns(): void {
  const cases: string[][] = [
    // A separate directory.
    workflow([], ...checkout, ...download("path: ${{ runner.temp }}/artifacts"), "- run: make report"),
    workflow([], ...checkout, "- run: gh run download ${{ github.event.workflow_run.id }} --dir /tmp/results", "- run: ./scripts/post.sh"),
    workflow([], ...checkout, "- uses: actions/github-script@v7", "  with:", "    script: await github.rest.actions.downloadArtifact({ artifact_id })", "- run: unzip pr.zip -d pr", "- run: npm run comment"),
    // Nothing checked out and nothing run from the workspace.
    workflow([], ...download(), "- uses: actions/github-script@v7"),
    // Runs from this repository's branches only.
    workflow(["if: github.event.workflow_run.event == 'push'"], ...checkout, ...download(), "- run: make deploy"),
    // Artifacts of another run, picked by this workflow.
    workflow([], ...checkout, "- uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c", "  with:", "    name: build", "- run: make deploy")
  ];
  for (const lines of cases) {
    assert.deepEqual(findings([added(".github/workflows/comment.yml", lines)]), [], lines.join(" | "));
  }

  // Workflows with other triggers.
  const push = ["on: push", "jobs:", "  build:", "    runs-on: ubuntu-latest", "    steps:", ...checkout.map((line) => `      ${line}`), ...download().map((line) => `      ${line}`)];
  assert.deepEqual(findings([added(".github/workflows/build.yml", push)]), []);
}

export function testWorkflowArtifactPoisoningSkipsExamplesAndCanBeDisabled(): void {
  const lines = workflow([], ...checkout, ...download(), "- run: make report");
  assert.deepEqual(findings([added("examples/.github/workflows/comment.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { workflowArtifactPoisoning: { enabled: false } } });
  assert.deepEqual(findings([added(".github/workflows/comment.yml", lines)], config), []);
}
