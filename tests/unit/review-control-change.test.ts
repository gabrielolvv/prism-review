import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testReviewControlChangeReportsCodeOwners(): void {
  const findings = controlFindings([
    changed(".github/CODEOWNERS", "modified", ["@@ -1 +1 @@", "-src/ @acme/core", "+src/ @someone"]),
    changed("docs/CODEOWNERS", "removed", ["@@ -1 +0,0 @@", "-* @acme/docs"]),
    { ...changed("CODEOWNERS", "renamed", []), previousPath: "old/CODEOWNERS" },
    { ...changed("misc/owners.txt", "renamed", []), previousPath: ".github/CODEOWNERS" },
    // GitHub only reads the three locations, so these are ordinary files.
    changed("src/CODEOWNERS", "modified", ["@@ -1 +1 @@", "-a", "+b"]),
    changed("CODEOWNERS.md", "added", ["@@ -0,0 +1 @@", "+# Owners"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.title, finding.severity]),
    [
      [".github/CODEOWNERS", "Code owners changed", "warning"],
      ["docs/CODEOWNERS", "Code owners changed", "warning"],
      ["CODEOWNERS", "Code owners changed", "warning"],
      ["misc/owners.txt", "Code owners changed", "warning"]
    ]
  );
  assert.match(findings[1]?.message ?? "", /^This pull request removes a CODEOWNERS file/);
}

export function testReviewControlChangeReportsGeneratedMarkers(): void {
  const findings = controlFindings([
    changed(".gitattributes", "modified", [
      "@@ -1,3 +1,4 @@",
      " *.sh text eol=lf",
      "-dist/** linguist-generated",
      "+dist/** linguist-generated",
      "+src/** linguist-generated",
      " *.png binary"
    ]),
    changed("packages/web/.gitattributes", "modified", ["@@ -2 +1,0 @@", "-vendor/** linguist-vendored"]),
    // Other attributes do not change the review.
    changed("app/.gitattributes", "modified", ["@@ -1 +1 @@", "-*.sh text", "+*.sh text eol=lf"]),
    // A patch over the size limit is reported, since it cannot be checked.
    { path: "big/.gitattributes", status: "modified", additions: 9000, deletions: 0 }
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.lines]),
    [
      [".gitattributes", 2, [2, 3]],
      ["packages/web/.gitattributes", undefined, undefined],
      ["big/.gitattributes", undefined, undefined]
    ]
  );
  assert.match(findings[0]?.message ?? "", /^Lines 2, 3 change which files are marked linguist-generated or linguist-vendored\./);
  assert.match(findings[1]?.message ?? "", /^This change removes lines that set which files are marked/);
  assert.match(findings[2]?.message ?? "", /^This \.gitattributes change could not be inspected/);
}

export function testReviewControlChangeCannotBeHidden(): void {
  const config = prismConfigSchema.parse({ ignorePaths: ["**"] });
  const suppress = ["prism-review", "ignore"].join("-");
  const files = [
    changed(".github/CODEOWNERS", "modified", ["@@ -1 +1 @@", "-* @acme/core", "+* @someone"]),
    changed(".gitattributes", "modified", ["@@ -0,0 +1 @@", `+src/** linguist-generated # ${suppress} review-control-change -- fine`])
  ];

  const result = analyzePullRequest(files, config);
  assert.deepEqual(
    result.findings.filter((finding) => finding.ruleId === "review-control-change").map((finding) => finding.file),
    [".github/CODEOWNERS", ".gitattributes"]
  );
  assert.deepEqual(result.suppressed, []);
}

function controlFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "review-control-change");
}

function changed(path: string, status: ChangedFile["status"], patchLines: string[]): ChangedFile {
  const additions = patchLines.filter((line) => line.startsWith("+")).length;
  const deletions = patchLines.filter((line) => line.startsWith("-")).length;
  return { path, status, additions, deletions, ...(patchLines.length > 0 ? { patch: patchLines.join("\n") } : {}) };
}
