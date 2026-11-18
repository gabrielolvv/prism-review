import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unpinnedRemoteSourceRule } from "../../src/rules/unpinned-remote-source.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unpinnedRemoteSourceRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const module = (...body: string[]) => ["module \"network\" {", ...body.map((line) => `  ${line}`), "  name = \"prod\"", "}"];

export function testUnpinnedRemoteSourceReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/main.tf", [...module("source = \"git::https://github.com/acme/terraform-network.git?ref=main\""), ...module("source = \"terraform-aws-modules/vpc/aws\"")])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Code pulled from a moving reference");
  assert.deepEqual(finding?.lines, [2, 6]);
  assert.equal(
    finding?.message,
    "In lines 2, 6, the change pulls Terraform modules from a branch or without a version, so whoever can push to them changes this infrastructure at the next `init`: `git::https://github.com/acme/terraform-network.git` and `terraform-aws-modules/vpc/aws`."
  );
}

export function testUnpinnedRemoteSourceReadsEachSource(): void {
  const cases: Array<[string, string[]]> = [
    // Git sources with no ref, and the GitHub shorthand.
    ["infra/main.tf", module("source = \"github.com/acme/terraform-workspacer\"")],
    ["live/prod/terragrunt.hcl", ["terraform {", "  source = \"git::git@github.com:acme/modules.git//vpc\"", "}"]],
    ["live/prod/terragrunt.hcl", ["terraform {", "  source = \"tfr:///terraform-aws-modules/vpc/aws\"", "}"]],
    // pre-commit hooks at a branch.
    [".pre-commit-config.yaml", ["repos:", "  - repo: https://github.com/acme/hooks", "    rev: master", "    hooks:", "      - id: lint"]],
    // GitLab includes: a remote file, a project on its default branch, and a component at `~latest`.
    [".gitlab-ci.yml", ["include:", "  - remote: 'https://gitlab.com/acme/ci/-/raw/main/templates/build.yml'"]],
    [".gitlab-ci.yml", ["include:", "  - project: acme/ci-templates", "    file: /build.yml", "stages: [build]"]],
    [".gitlab/ci/deploy.yml", ["include:", "  - component: $CI_SERVER_FQDN/acme/components/deploy@~latest"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnpinnedRemoteSourceSkipsPinnedAndLocalSources(): void {
  const cases: Array<[string, string[]]> = [
    // Tags, commits, versions, and local modules.
    ["infra/main.tf", module("source = \"git::https://github.com/acme/network.git?ref=v1.4.0\"")],
    ["infra/main.tf", module("source = \"git::https://github.com/poseidon/terraform-render-bootstrap.git?ref=e958673eb6561b0a975f22f35788750b03a1f7c2\"")],
    ["infra/main.tf", module("source = \"terraform-aws-modules/vpc/aws\"", "version = \"5.1.2\"")],
    ["infra/main.tf", module("source = \"./modules/network\"")],
    ["infra/main.tf", module("source = \"git::https://github.com/acme/network.git?ref=${var.module_version}\"")],
    // tflint plugins, which carry their own `version`.
    [".tflint.hcl", ["plugin \"aws\" {", "  source = \"github.com/terraform-linters/tflint-ruleset-aws\"", "  version = \"0.30.0\"", "}"]],
    // Pinned hooks, local hooks, and pinned or variable GitLab includes.
    [".pre-commit-config.yaml", ["repos:", "  - repo: https://github.com/pre-commit/pre-commit-hooks", "    rev: v4.6.0", "  - repo: local", "    hooks: []"]],
    [".gitlab-ci.yml", ["include:", "  - project: acme/ci-templates", "    ref: 11.10.1", "    file: /build.yml"]],
    [".gitlab-ci.yml", ["include:", "  - component: $CI_SERVER_FQDN/acme/components/deploy@2.1.0", "  - project: '${CI_PROJECT_NAMESPACE}/templates'", "    ref: $CI_COMMIT_REF_NAME"]],
    [".gitlab-ci.yml", ["include:", "  - local: .gitlab/ci/*.yml"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnpinnedRemoteSourceSkipsTestsAndCanBeDisabled(): void {
  const lines = module("source = \"terraform-aws-modules/vpc/aws\"");
  assert.deepEqual(findings([added("test/fixtures/main.tf", lines)]), []);
  assert.deepEqual(findings([added("examples/complete/main.tf", lines)]), []);
  assert.deepEqual(findings([added("inttest/conformance/main.tf", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { unpinnedRemoteSource: { enabled: false } } });
  assert.deepEqual(findings([added("infra/main.tf", lines)], config), []);
}
