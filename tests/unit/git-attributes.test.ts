import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { parseGitAttributes } from "../../src/analysis/git-attributes.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testGitAttributesFollowGitRules(): void {
  const attributes = parseGitAttributes(
    [
      "# Generated code",
      "*.min.js linguist-generated",
      "/dist/** linguist-generated=true",
      "api/client.ts linguist-generated -diff",
      "third_party/** linguist-vendored",
      "third_party/ours/** -linguist-vendored",
      "proto/** linguist-generated",
      "proto/hand-written.ts linguist-generated=false",
      "lib/** linguist-generated",
      "lib/keep.ts !linguist-generated",
      "vendor/ linguist-vendored",
      "vendored linguist-vendored",
      "!negated linguist-generated",
      '"quoted path.ts" linguist-generated',
      "[attr]gen linguist-generated",
      "*.png binary",
      "*.ts text eol=lf"
    ].join("\r\n")
  );
  const cases: Array<[string, boolean]> = [
    ["assets/app.min.js", true],
    ["app.min.js", true],
    ["dist/index.cjs", true],
    ["src/dist/index.cjs", false],
    ["api/client.ts", true],
    ["src/api/client.ts", false],
    ["third_party/lib/a.c", true],
    ["third_party/ours/a.c", false],
    ["proto/gen.ts", true],
    ["proto/hand-written.ts", false],
    ["lib/keep.ts", false],
    ["lib/other.ts", true],
    // A directory pattern does not reach the files in it, in gitattributes.
    ["vendor/a.js", false],
    ["vendored/a.js", false],
    ["src/vendored", true],
    ["negated", false],
    ["quoted path.ts", false],
    ["image.png", false],
    ["src/app.ts", false]
  ];
  for (const [path, expected] of cases) {
    assert.equal(attributes.isGenerated(path), expected, path);
  }
  assert.equal(parseGitAttributes("").isGenerated("a.ts"), false);
}

export function testGeneratedFilesAreLeftOutOfNoiseRulesOnly(): void {
  const attributes = parseGitAttributes("src/gen/** linguist-generated\n");
  // Assembled so this file does not trip the rules it tests in its own pull request.
  const token = ["ghp", "_", "Q".repeat(36)].join("");
  const disableAll = ["/* eslint", "-disable */"].join("");
  const files: ChangedFile[] = [
    file("src/gen/client.ts", ["const run = (code: string) => eval(code);", disableAll]),
    file("src/gen/config.ts", [`export const token = "${token}";`]),
    // A file moved out of reviewed code is still reviewed, so a rename cannot hide a change.
    { ...file("src/gen/moved.ts", ["const value = eval(input);"]), status: "renamed", previousPath: "src/moved.ts" },
    file("src/app.ts", ["export const answer = 42;"])
  ];

  const result = analyzePullRequest(files, defaultConfig, { isGenerated: attributes.isGenerated });
  const byRule = (ruleId: string) => result.findings.filter((finding) => finding.ruleId === ruleId).map((finding) => finding.file);

  assert.deepEqual(byRule("risky-api"), ["src/gen/moved.ts"]);
  assert.deepEqual(byRule("blanket-suppression"), []);
  // Secrets are found in every file, generated or not.
  assert.deepEqual(byRule("secret-in-diff"), ["src/gen/config.ts"]);
  assert.match(result.summary, /^Reviewed 2 changed file\(s\), 2 more marked generated or vendored in \.gitattributes\./);

  const both = analyzePullRequest(files, prismConfigSchema.parse({ ignorePaths: ["src/gen/client.ts"] }), {
    isGenerated: attributes.isGenerated
  });
  assert.match(both.summary, /^Reviewed 2 changed file\(s\), 1 more ignored by ignorePaths, 1 more marked generated or vendored in \.gitattributes\./);

  assert.equal(defaultConfig.ignoreGenerated, true);
  assert.equal(prismConfigSchema.parse({ ignoreGenerated: false }).ignoreGenerated, false);
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
