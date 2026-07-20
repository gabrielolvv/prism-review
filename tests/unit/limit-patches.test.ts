import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig } from "../../src/config/schema.js";
import { limitPatchSizes } from "../../src/security/limit-patches.js";

export function testLimitPatchSizesOmitsOversizedPatches(): void {
  const files = [changedFile("src/small.ts", "+ok"), changedFile("src/huge.ts", "+".repeat(64))];

  const limited = limitPatchSizes(files, 32);

  assert.equal(limited[0]?.patch, "+ok");
  assert.equal(limited[0]?.patchOmitted, undefined);
  assert.equal(limited[1]?.patch, undefined);
  assert.equal(limited[1]?.patchOmitted, true);
  assert.equal(files[1]?.patch?.length, 64);
}

export function testLimitPatchSizesCountsBytes(): void {
  const files = [changedFile("docs/notes.md", "é".repeat(20))];

  const limited = limitPatchSizes(files, 32);

  assert.equal(limited[0]?.patchOmitted, true);
}

export function testOversizedPatchRuleReportsOmittedPatches(): void {
  const files = limitPatchSizes([changedFile("docs/huge.md", "+".repeat(64))], 32);

  const result = analyzePullRequest(files, defaultConfig);
  const findings = result.findings.filter((finding) => finding.ruleId === "oversized-patch");

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "info");
  assert.equal(findings[0]?.file, "docs/huge.md");
  assert.equal(result.riskLevel, "low");
}

function changedFile(path: string, patch: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 0, patch };
}
