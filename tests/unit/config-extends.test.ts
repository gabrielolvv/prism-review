import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import { parseExtends, resolveConfig } from "../../src/config/extends.js";
import { defaultConfig } from "../../src/config/schema.js";

export function testParseExtendsReadsBothForms(): void {
  assert.deepEqual(parseExtends(".github/prism-review-base.yml", "x"), { kind: "local", path: ".github/prism-review-base.yml" });
  assert.deepEqual(parseExtends("./config/review.yml", "x"), { kind: "local", path: "config/review.yml" });
  assert.deepEqual(parseExtends("acme/policies/prism/review.yml@v2", "x"), {
    kind: "remote",
    owner: "acme",
    repo: "policies",
    path: "prism/review.yml",
    ref: "v2"
  });
  assert.deepEqual(parseExtends("acme/.github/review.yml@0123456789abcdef0123456789abcdef01234567", "x"), {
    kind: "remote",
    owner: "acme",
    repo: ".github",
    path: "review.yml",
    ref: "0123456789abcdef0123456789abcdef01234567"
  });

  // Paths outside the repository, absolute paths, and Windows separators are refused.
  for (const value of ["../shared/review.yml", "config/../../review.yml", "/etc/review.yml", "config\\review.yml", "acme/policies/review.yml@"]) {
    assert.throws(() => parseExtends(value, "x"), /extends must be a path in this repository/, value);
  }
}

export async function testResolveConfigLimitsTheDepth(): Promise<void> {
  // Each file extends the next, more than five deep.
  const read = async (target: { kind: string; path?: string }) => {
    const index = Number(/(\d+)/.exec(target.path ?? "")?.[1]);
    return { raw: `extends: level${index + 1}.yml\n`, source: target.path ?? "" };
  };

  await assert.rejects(resolveConfig("extends: level1.yml\n", ".prism-review.yml", read, ".prism-review.yml"), /extends goes more than 5 files deep\./);
}

export async function testResolveConfigRejectsInvalidMergedSettings(): Promise<void> {
  const read = async () => ({ raw: "check:\n  failOn: sometimes\n", source: "base.yml" });

  await assert.rejects(resolveConfig("extends: base.yml\n", ".prism-review.yml", read), /\.prism-review\.yml: check\.failOn: /);
}

export function testConfigChangeReportsExtendedFiles(): void {
  const files = [
    { path: ".github/prism-review-base.yml", status: "modified" as const, additions: 1, deletions: 1, patch: "@@ -1 +1 @@\n-a: 1\n+a: 2" },
    { path: "src/app.ts", status: "modified" as const, additions: 1, deletions: 0, patch: "@@ -1 +1,2 @@\n x\n+y" }
  ];

  const findings = analyzePullRequest(files, defaultConfig, { extendedConfigPaths: ["./.github/prism-review-base.yml"] }).findings.filter(
    (finding) => finding.ruleId === "config-change"
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "high");
  assert.equal(findings[0]?.file, ".github/prism-review-base.yml");
  assert.match(findings[0]?.message ?? "", /^The Prism Review configuration extends this file/);

  assert.ok(!analyzePullRequest(files, defaultConfig).findings.some((finding) => finding.ruleId === "config-change"));
}
