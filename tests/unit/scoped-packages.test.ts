import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

const manifest: ChangedFile = {
  path: "package.json",
  status: "modified",
  additions: 4,
  deletions: 2,
  patch: [
    "@@ -10,6 +10,8 @@",
    '   "devDependencies": {',
    '-    "@babel/core": "^7.20.0",',
    '+    "@babel/core": "*",',
    '+    "@types/node": "^24.0.14",',
    '+    "@typse/node": "^24.0.14",',
    '-    "@acme/old-utils": "1.2.0",',
    '+    "@acme/utils": "workspace:*",',
    '     "typescript": "^5.8.3"'
  ].join("\n")
};

export function testScopedNpmPackagesAreDependencyChanges(): void {
  assert.deepEqual(
    dependencyChanges([manifest]).map(({ name, from, to, line }) => [name, from, to, line]),
    [
      ["@babel/core", "^7.20.0", "*", 11],
      ["@types/node", undefined, "^24.0.14", 12],
      ["@typse/node", undefined, "^24.0.14", 13],
      ["@acme/utils", undefined, "workspace:*", 14],
      ["@acme/old-utils", "1.2.0", undefined, undefined]
    ]
  );

  // A `name` field with a scope is the package itself, not a dependency.
  const own: ChangedFile = { ...manifest, patch: '@@ -1,2 +1,2 @@\n-  "name": "@acme/app",\n+  "name": "@acme/web",' };
  assert.deepEqual(dependencyChanges([own]), []);
}

export function testScopedNpmPackagesGoThroughTheDependencyRules(): void {
  const result = analyzePullRequest([manifest], defaultConfig, { existingLockfiles: new Set(["package-lock.json"]) });
  const byRule = (ruleId: string) => result.findings.filter((finding) => finding.ruleId === ruleId);

  // An open version on a scoped package is reported; a scoped name is not compared with popular ones.
  assert.match(byRule("risky-dependency-version")[0]?.message ?? "", /@babel\/core/);
  assert.deepEqual(byRule("lookalike-dependency"), []);
  assert.equal(byRule("stale-lockfile").length, 1);

  const markdown = renderMarkdown(result, { includeLowSeverity: false });
  assert.match(markdown, /^\| `package\.json` \| `@types\/node` \| added `\^24\.0\.14` \|$/m);
}
