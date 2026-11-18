import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { selfHostedPrRunnerRule } from "../../src/rules/self-hosted-pr-runner.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return selfHostedPrRunnerRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const workflow = (trigger: string[], ...job: string[]) => ["name: CI", ...trigger, "jobs:", "  test:", ...job.map((line) => `    ${line}`), "    steps:", "      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd", "      - run: make test"];
const onPullRequest = ["on:", "  pull_request:", "    branches: [main]"];

export function testSelfHostedPrRunnerReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added(".github/workflows/ci.yml", workflow(onPullRequest, "runs-on: [self-hosted, linux, x64]"))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Pull request jobs on a self-hosted runner");
  assert.deepEqual(finding?.lines, [7]);
  assert.equal(
    finding?.message,
    "Line 7 runs `test` on a self-hosted runner for pull requests, including those from forks, whose code then runs on your machine. By default, GitHub asks a maintainer to approve the run only for first-time contributors, and code that runs there can stay on the machine, read the secrets and caches of later jobs, and reach the network the runner is in, as in the 2024 attacks on PyTorch's runners."
  );
}

export function testSelfHostedPrRunnerReadsEachForm(): void {
  const cases: Array<[string[], string[]]> = [
    // Other trigger forms, a plain label, and a list on the lines below.
    [["on: [push, pull_request]"], ["runs-on: self-hosted"]],
    [["on:", "  - push", "  - pull_request"], ["runs-on:", "  - self-hosted", "  - gpu"]],
    // A runner picked through the matrix.
    [onPullRequest, ["strategy:", "  matrix:", "    include:", "      - runner: [self-hosted, windows]", "runs-on: ${{ matrix.runner }}"]],
    // A condition that does not keep forks out.
    [onPullRequest, ["if: github.event.pull_request.draft == false", "runs-on: [self-hosted, linux]"]]
  ];
  for (const [trigger, job] of cases) {
    const lines = workflow(trigger, ...job);
    assert.equal(findings([added(".github/workflows/ci.yml", lines)]).length, 1, lines.join(" | "));
  }
}

export function testSelfHostedPrRunnerSkipsGuardedAndHostedJobs(): void {
  const cases: Array<[string[], string[]]> = [
    // Jobs that keep fork pull requests out, or wait for a maintainer.
    [onPullRequest, ["if: github.event.pull_request.head.repo.full_name == github.repository", "runs-on: [self-hosted, linux]"]],
    [onPullRequest, ["if: \"! github.event.pull_request.head.repo.fork\"", "runs-on: self-hosted"]],
    [onPullRequest, ["if: contains(github.event.pull_request.labels.*.name, 'ok-to-test')", "runs-on: self-hosted"]],
    [onPullRequest, ["if: |", "  needs.setup.outputs.is-ent-repo == 'true' &&", "  github.event.pull_request.draft == false", "runs-on: [self-hosted, linux]"]],
    // Runners picked by repository, as projects with a private enterprise copy do.
    [onPullRequest, ["runs-on: ${{ github.repository == 'acme/app' && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"linux\"]') }}"]],
    // GitHub-hosted runners, other triggers, and comments.
    [onPullRequest, ["runs-on: ubuntu-latest"]],
    [["on:", "  push:", "    branches: [main]", "  pull_request_target:"], ["runs-on: [self-hosted, linux]"]],
    [onPullRequest, ["# runs-on: self-hosted", "runs-on: ubuntu-latest"]]
  ];
  for (const [trigger, job] of cases) {
    const lines = workflow(trigger, ...job);
    assert.deepEqual(findings([added(".github/workflows/ci.yml", lines)]), [], lines.join(" | "));
  }
}

export function testSelfHostedPrRunnerSkipsExamplesAndCanBeDisabled(): void {
  const lines = workflow(onPullRequest, "runs-on: self-hosted");
  assert.deepEqual(findings([added("examples/.github/workflows/ci.yml", lines)]), []);
  assert.deepEqual(findings([added("ci/workflow.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { selfHostedPrRunner: { enabled: false } } });
  assert.deepEqual(findings([added(".github/workflows/ci.yml", lines)], config), []);
}
