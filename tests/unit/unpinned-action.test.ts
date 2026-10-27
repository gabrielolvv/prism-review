import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

const sha = "0123456789abcdef0123456789abcdef01234567";

export function testUnpinnedActionRuleReportsTagsBranchesAndImages(): void {
  const findings = actionFindings([
    file(".github/workflows/ci.yml", [
      "jobs:",
      "  build:",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - uses: tj-actions/changed-files@v45",
      `      - uses: "codecov/codecov-action@main"`,
      `      - uses: aws-actions/configure-aws-credentials@${sha} # v4.0.2`,
      "      - uses: docker://alpine:3.20",
      `      - uses: docker://ghcr.io/acme/tool@sha256:${"a".repeat(64)}`,
      "      - uses: ./.github/actions/setup",
      "  deploy:",
      "    uses: acme/shared-workflows/.github/workflows/deploy.yml@main"
    ]),
    file("tools/release/action.yml", ["runs:", "  using: composite", "  steps:", "    - uses: softprops/action-gh-release@v2"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]),
    [
      [".github/workflows/ci.yml", 5, "warning"],
      ["tools/release/action.yml", 4, "warning"]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 5, 6, 8, 12 use actions by a tag or branch that can be moved to other code (tj-actions/changed-files@v45, codecov/codecov-action@main, acme/shared-workflows/.github/workflows/deploy.yml@main), and a container image without a digest (docker://alpine:3.20)."
  );
  assert.equal(
    findings[1]?.message,
    "Line 4 uses an action by a tag or branch that can be moved to other code (softprops/action-gh-release@v2)."
  );
}

export function testUnpinnedActionRuleSkipsCommentsOtherFilesAndAllowedOwners(): void {
  const config = prismConfigSchema.parse({ rules: { unpinnedActions: { allowedOwners: ["actions", "github", "Acme"] } } });
  const files = [
    file(".github/workflows/ci.yml", [
      "      # - uses: tj-actions/changed-files@v45",
      "      - uses: acme/internal-action@v1",
      "      - uses: github/codeql-action/init@v3",
      "      - name: uses: some/action@v1"
    ]),
    file("docs/ci.md", ["- uses: tj-actions/changed-files@v45"]),
    file(".github/dependabot.yml", ["      - uses: tj-actions/changed-files@v45"])
  ];

  assert.deepEqual(
    analyzePullRequest(files, config).findings.filter((finding) => finding.ruleId === "unpinned-action"),
    []
  );
}

export function testUnpinnedActionRuleSeesIgnoredFilesAndCanBeDisabled(): void {
  const files = [file(".github/workflows/ci.yml", ["      - uses: tj-actions/changed-files@v45"])];
  const ignoring = prismConfigSchema.parse({ ignorePaths: ["**/*.yml"] });
  const disabled = prismConfigSchema.parse({ rules: { unpinnedActions: { enabled: false } } });

  assert.ok(analyzePullRequest(files, ignoring).findings.some((finding) => finding.ruleId === "unpinned-action"));
  assert.ok(!analyzePullRequest(files, disabled).findings.some((finding) => finding.ruleId === "unpinned-action"));
}

function actionFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "unpinned-action");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
