import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { workflowCredentialExposureRule } from "../../src/rules/workflow-credential-exposure.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return workflowCredentialExposureRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const job = (...steps: string[]) => ["name: build", "on: pull_request", "jobs:", "  build:", "    runs-on: ubuntu-latest", "    steps:", ...steps];
const checkout = (ref = "v4", ...settings: string[]) => [`      - uses: actions/checkout@${ref}`, ...(settings.length > 0 ? ["        with:", ...settings.map((setting) => `          ${setting}`)] : [])];
const upload = (ref = "v3", ...settings: string[]) => [`      - uses: actions/upload-artifact@${ref}`, "        with:", "          name: site", ...settings.map((setting) => `          ${setting}`)];

export function testWorkflowCredentialExposureReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added(".github/workflows/build.yml", job(...checkout(), "      - run: make", ...upload("v3", "path: .")))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Workflow hands out its token");
  assert.deepEqual(finding?.lines, [12]);
  assert.equal(
    finding?.message,
    "In line 12, the workflow uploads the checked-out workspace as an artifact with the token `actions/checkout` saved in `.git/config`, so anyone who can download the artifact can use the token while the run lasts."
  );
}

export function testWorkflowCredentialExposureReadsEachExposure(): void {
  const cases: Array<[string, string[]]> = [
    [".github/workflows/build.yml", job(...checkout("v5"), ...upload("v4", "path: ${{ github.workspace }}", "include-hidden-files: true"))],
    [".github/workflows/build.yml", job(...checkout("b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1"), ...upload("v4.3.6", "path: ./"))],
    [".github/workflows/build.yml", job("      - run: make", "        env:", "          ACTIONS_ALLOW_UNSECURE_COMMANDS: true")],
    [".github/workflows/build.yml", job("      - run: echo \"ACTIONS_ALLOW_UNSECURE_COMMANDS=true\" >> \"$GITHUB_ENV\"")]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWorkflowCredentialExposureSkipsSafeWorkflows(): void {
  const cases: Array<[string, string[]]> = [
    // Credentials not kept, newer checkout and upload versions, and uploads of the build output only.
    [".github/workflows/build.yml", job(...checkout("v4", "persist-credentials: false"), ...upload("v3", "path: ."))],
    [".github/workflows/build.yml", job(...checkout("v6"), ...upload("v3", "path: ."))],
    [".github/workflows/build.yml", job(...checkout("v4"), ...upload("v4", "path: ."))],
    [".github/workflows/build.yml", job(...checkout("v4"), ...upload("v3", "path: dist/"))],
    [".github/workflows/build.yml", job(...upload("v3", "path: ."))],
    // Unsecure commands left off.
    [".github/workflows/build.yml", job("      - run: make", "        env:", "          ACTIONS_ALLOW_UNSECURE_COMMANDS: false")],
    // Other files, example workflows, and a scanner's test fixtures.
    ["tests/resources/.github/workflows/unsecure.yml", job("      - run: make", "        env:", "          ACTIONS_ALLOW_UNSECURE_COMMANDS: true")],
    ["ci/build.yml", job(...checkout(), ...upload("v3", "path: ."))],
    ["examples/.github/workflows/build.yml", job(...checkout(), ...upload("v3", "path: ."))]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWorkflowCredentialExposureCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { workflowCredentialExposure: { enabled: false } } });
  assert.deepEqual(findings([added(".github/workflows/build.yml", job(...checkout(), ...upload("v3", "path: .")))], config), []);
}
