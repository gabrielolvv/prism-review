import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { privilegedPrCheckoutRule } from "../../src/rules/privileged-pr-checkout.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return privilegedPrCheckoutRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const workflow = (trigger: string[], condition: string[], ...steps: string[]) => [
  "name: E2E",
  "on:",
  ...trigger.map((line) => `  ${line}`),
  "jobs:",
  "  e2e:",
  ...condition.map((line) => `    ${line}`),
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
  ...steps.map((line) => `      ${line}`)
];
const comment = ["issue_comment:", "  types: [created]"];
const checkoutPr = ["- run: gh pr checkout ${{ github.event.issue.number }}", "  env:", "    GH_TOKEN: ${{ github.token }}"];

export function testPrivilegedPrCheckoutReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added(".github/workflows/e2e.yml", workflow(comment, ["if: contains(github.event.comment.body, '/e2e')"], ...checkoutPr, "- run: make e2e"))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Pull request code fetched in a privileged workflow");
  assert.deepEqual(finding?.lines, [11]);
  assert.equal(
    finding?.message,
    "Line 11 fetches a pull request's code in a workflow that runs with the repository's secrets and a write token, and that anyone can start from a fork or a comment. Later steps run code from the workspace, so the pull request's own scripts and build files run with that access."
  );

  const [scan] = findings([added(".github/workflows/scan.yml", workflow(["pull_request_target: {}"], [], "- run: gh pr checkout ${{ github.event.number }}", "- run: semgrep ci"))]);
  assert.equal(scan?.severity, "warning");
}

export function testPrivilegedPrCheckoutReadsEachCommand(): void {
  const cases: string[][] = [
    workflow(["pull_request_target:"], [], "- run: |", "    git fetch origin pull/${{ github.event.number }}/head:pr", "    git checkout pr", "- run: npm test"),
    workflow(["pull_request_target:"], [], "- run: git checkout ${{ github.event.pull_request.head.sha }}", "- run: ./scripts/check.sh"),
    workflow(["workflow_run:", "  workflows: [CI]", "  types: [completed]"], [], "- run: git clone ${{ github.event.pull_request.head.repo.clone_url }} pr", "- run: make -C pr"),
    workflow(comment, [], "- run: hub pr checkout ${{ github.event.issue.number }}")
  ];
  for (const lines of cases) {
    assert.equal(findings([added(".github/workflows/e2e.yml", lines)]).length, 1, lines.join(" | "));
  }
}

export function testPrivilegedPrCheckoutSkipsMaintainerJobsAndPullRequestTriggers(): void {
  const cases: string[][] = [
    // Maintainers only: association, team membership, a permission lookup, and an approval label.
    workflow(comment, ["if: contains(fromJSON('[\"OWNER\",\"MEMBER\"]'), github.event.comment.author_association)"], ...checkoutPr, "- run: make e2e"),
    workflow(comment, [], "- uses: tspascoal/get-user-teams-membership@v4", "  id: member", "- if: steps.member.outputs.isTeamMember == 'true'", "  run: gh pr checkout ${{ github.event.issue.number }}", "- run: make e2e"),
    workflow(["pull_request_target:", "  types: [labeled]"], ["if: github.event.label.name == 'ok-to-test'"], "- run: gh pr checkout ${{ github.event.number }}", "- run: make e2e"),
    // Unprivileged triggers, and other git commands.
    workflow(["pull_request:"], [], "- run: gh pr checkout ${{ github.event.number }}", "- run: make e2e"),
    workflow(comment, [], "- run: gh pr view ${{ github.event.issue.number }} --json title", "- run: git fetch origin main"),
    // Comments.
    workflow(comment, [], "# - run: gh pr checkout ${{ github.event.issue.number }}")
  ];
  for (const lines of cases) {
    assert.deepEqual(findings([added(".github/workflows/e2e.yml", lines)]), [], lines.join(" | "));
  }
}

export function testPrivilegedPrCheckoutSkipsExamplesAndCanBeDisabled(): void {
  const lines = workflow(comment, [], ...checkoutPr, "- run: make e2e");
  assert.deepEqual(findings([added("examples/.github/workflows/e2e.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { privilegedPrCheckout: { enabled: false } } });
  assert.deepEqual(findings([added(".github/workflows/e2e.yml", lines)], config), []);
}
