import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

// Built at runtime so this file trips none of the rules it tests.
const ev = ["ev", "al"].join("");
const token = `ghp_${"a1B2".repeat(9)}`;
const rlo = String.fromCodePoint(0x202e);

const config = prismConfigSchema.parse({
  ignorePaths: ["dist/**", "vendor/**", "**/*.yml"],
  risk: { largeDiff: { maxFiles: 2, maxChangedLines: 100 } }
});

export function testIgnorePathsSkipsNoiseRules(): void {
  const files = [
    file("dist/index.js", [`module.exports = ${ev}(code);`], 5000),
    file("vendor/lib/run.py", [`${ev}(source)`]),
    file("src/feature.ts", ["export const feature = true;"])
  ];

  const result = analyzePullRequest(files, config);

  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId),
    ["missing-tests"],
    "risky-api and large-diff should not see dist/ or vendor/"
  );
  assert.equal(
    result.summary,
    "Reviewed 1 changed file(s), 2 more ignored by ignorePaths. Found 0 high-risk and 1 warning-level signal(s)."
  );
  assert.equal(result.riskLevel, "low");
}

export function testIgnorePathsNeverHidesSecurityFindings(): void {
  const files = [
    file("dist/index.js", [`const key = "${token}";`]),
    file("vendor/lib/check.js", [`/*${rlo} } */ return true;`]),
    file(".prism-review.yml", ["ignorePaths: []"])
  ];

  const ruleIds = analyzePullRequest(files, config, { configPath: ".prism-review.yml" }).findings.map(
    (finding) => finding.ruleId
  );

  assert.deepEqual([...ruleIds].sort(), ["config-change", "hidden-unicode", "secret-in-diff"]);
}

export function testIgnorePathsDefaultsToReviewingEverything(): void {
  const files = [file("dist/index.js", [`module.exports = ${ev}(code);`])];

  const result = analyzePullRequest(files, defaultConfig);

  assert.deepEqual(defaultConfig.ignorePaths, []);
  assert.ok(result.findings.some((finding) => finding.ruleId === "risky-api"));
  assert.match(result.summary, /^Reviewed 1 changed file\(s\)\. /);
}

function file(path: string, lines: string[], extraAdditions = 0): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length + extraAdditions, deletions: 0, patch };
}
