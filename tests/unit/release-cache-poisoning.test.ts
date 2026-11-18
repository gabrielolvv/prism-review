import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { releaseCachePoisoningRule } from "../../src/rules/release-cache-poisoning.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return releaseCachePoisoningRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const workflow = (on: string[], ...steps: string[]) => ["name: Release", "on:", ...on.map((line) => `  ${line}`), "jobs:", "  release:", "    runs-on: ubuntu-latest", "    steps:", ...steps.map((line) => `      ${line}`)];

const tagPush = ["push:", "  tags: ['v*']"];

export function testReleaseCachePoisoningReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(
      ".github/workflows/release.yml",
      workflow(
        tagPush,
        "- uses: actions/checkout@v4",
        "- uses: actions/setup-node@v4",
        "  with:",
        "    node-version: 22",
        "    cache: npm",
        "- uses: actions/cache@v4",
        "  with:",
        "    path: ~/.cache/build",
        "    key: build-${{ hashFiles('package-lock.json') }}",
        "- run: npm ci && npm run build",
        "- run: npm publish --provenance"
      )
    )
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Release job restores a shared cache");
  assert.deepEqual(finding?.lines, [10, 14]);
  assert.match(finding?.message ?? "", /^In lines 10, 14, a release or publishing job restores a GitHub Actions cache with `actions\/setup-node` and `actions\/cache`\./);
}

export function testReleaseCachePoisoningReadsEachCache(): void {
  const cases: string[][] = [
    // setup-go caches by default from v4, including when pinned to a commit.
    workflow(tagPush, "- uses: actions/setup-go@v5", "- uses: goreleaser/goreleaser-action@v6", "  with:", "    args: release --clean"),
    workflow(["release:", "  types: [published]"], "- uses: actions/setup-go@0aaccfd150d50ccaeb58ebd88d36e91967a5f35b # v5.4.0", "- run: make dist", "- run: gh release upload ${{ github.ref_name }} dist/*"),
    // A publishing job in a workflow that also runs for branches.
    workflow(["push:", "  branches: [main]"], "- uses: Swatinem/rust-cache@v2", "- run: cargo publish"),
    workflow(tagPush, "- uses: ruby/setup-ruby@v1", "  with:", "    bundler-cache: true", "- run: gem push pkg/*.gem"),
    workflow(tagPush, "- uses: docker/build-push-action@v6", "  with:", "    push: true", "    cache-from: type=gha", "- run: docker push ghcr.io/acme/app:${{ github.ref_name }}"),
    workflow(tagPush, "- uses: actions/cache/restore@v4", "  with:", "    path: dist", "    key: dist", "- uses: pypa/gh-action-pypi-publish@release/v1")
  ];
  for (const lines of cases) {
    assert.equal(findings([added(".github/workflows/release.yml", lines)]).length, 1, lines.join(" | "));
  }
}

export function testReleaseCachePoisoningSkipsChecksAndUncachedReleases(): void {
  const cases: string[][] = [
    // Releases without caches, or with caching turned off.
    workflow(tagPush, "- uses: actions/setup-go@v5", "  with:", "    cache: false", "- run: goreleaser release --clean"),
    workflow(tagPush, "- uses: actions/setup-node@v4", "  with:", "    node-version: 22", "- run: npm publish"),
    workflow(tagPush, "- uses: actions/setup-go@v3", "- run: goreleaser release --clean"),
    // Checks that run on tags too, and local builds.
    workflow(["push:", "  branches: [main]", "  tags: ['v*']", "pull_request:"], "- uses: actions/setup-go@v5", "- run: go test ./..."),
    workflow(["pull_request:"], "- uses: actions/setup-go@v5", "- uses: goreleaser/goreleaser-action@v6", "  with:", "    args: build --snapshot --clean"),
    workflow(["push:", "  branches: ['**']"], "- uses: actions/cache@v4", "  with:", "    path: ~/.m2", "- run: docker push localhost:5000/test:latest"),
    // Commented steps.
    workflow(tagPush, "# - uses: actions/cache@v4", "- run: npm publish")
  ];
  for (const lines of cases) {
    assert.deepEqual(findings([added(".github/workflows/release.yml", lines)]), [], lines.join(" | "));
  }
}

export function testReleaseCachePoisoningSkipsExamplesAndCanBeDisabled(): void {
  const lines = workflow(tagPush, "- uses: actions/setup-go@v5", "- run: goreleaser release --clean");
  assert.deepEqual(findings([added("examples/.github/workflows/release.yml", lines)]), []);
  assert.deepEqual(findings([added(".github/release.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { releaseCachePoisoning: { enabled: false } } });
  assert.deepEqual(findings([added(".github/workflows/release.yml", lines)], config), []);
}
