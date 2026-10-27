import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testRiskyDependencyVersionReportsOlderAndOpenVersions(): void {
  const findings = versionFindings([
    changed("package.json", [
      "@@ -10,4 +10,5 @@",
      '-    "lodash": "4.17.21",',
      '+    "lodash": "4.17.20",',
      '-    "axios": "1.6.0",',
      '+    "axios": "latest",',
      '+    "left-pad": "*",',
      '-    "react": "^18.2.0",',
      '+    "react": "^18.3.0",'
    ]),
    changed("requirements.txt", ["@@ -1,2 +1,2 @@", "-requests>=2.31,<3", "+requests>=2.0", "-flask==3.0.0", "+flask"]),
    changed("Cargo.toml", ["@@ -5,2 +5,2 @@", " [dependencies]", '-serde = "1.0.193"', '+serde = "1"'])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.title, finding.lines]),
    [
      ["package.json", "Dependency moved to an older version", [10, 11, 12]],
      ["requirements.txt", "Dependency moved to an older version", [1, 2]]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 10, 11, 12 change dependency versions: lodash from 4.17.21 to 4.17.20, an older version; axios from 1.6.0 to latest, which accepts any future release; left-pad at *, which accepts any release."
  );
  assert.equal(
    findings[1]?.message,
    "Lines 1, 2 change dependency versions: requests from >=2.31,<3 to >=2.0, an older version; flask from ==3.0.0 to no version, which accepts any future release."
  );
}

export function testRiskyDependencyVersionLeavesBoundedChangesAlone(): void {
  const findings = versionFindings([
    // Upgrades, caret and tilde ranges, and Ruby's pessimistic operator are bounded.
    changed("package.json", [
      "@@ -1,3 +1,3 @@",
      '-    "lodash": "4.17.21",',
      '+    "lodash": "^4.17.21",',
      '-    "vue": "~3.3.0",',
      '+    "vue": "^3.4.0",',
      // URLs and Git sources have no comparable version.
      '-    "mylib": "git+https://github.com/user123/mylib.git#v9.0.0",',
      '+    "mylib": "git+https://github.com/user123/mylib.git#v2.0.0",'
    ]),
    changed("Gemfile", ["@@ -1 +1 @@", "-gem 'rails', '7.1.2'", "+gem 'rails', '~> 7.1'"]),
    // A new PyPI or RubyGems dependency without a version relies on a lockfile.
    changed("requirements.txt", ["@@ -0,0 +1 @@", "+numpy"]),
    // pip-compile inputs are loose on purpose.
    changed("requirements.in", ["@@ -1 +1 @@", "-django==4.2", "+django"])
  ]);

  assert.deepEqual(findings, []);
  const off = prismConfigSchema.parse({ rules: { riskyDependencyVersions: { enabled: false } } });
  assert.deepEqual(
    analyzePullRequest([changed("package.json", ["@@ -0,0 +1 @@", '+    "left-pad": "*",'])], off).findings.filter(
      (finding) => finding.ruleId === "risky-dependency-version"
    ),
    []
  );
}

function versionFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "risky-dependency-version");
}

function changed(path: string, lines: string[]): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch: lines.join("\n")
  };
}
