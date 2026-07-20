import assert from "node:assert/strict";
import { prismConfigSchema } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testPrepareChangedFilesLimitsThenRedacts(): void {
  const config = prismConfigSchema.parse({ security: { maxPatchBytes: 400 } });
  const files = [
    ...loadDiffFixture("fixtures/diffs/secret-leak.diff"),
    ...loadDiffFixture("fixtures/diffs/risky-auth-change.diff")
  ];

  const prepared = prepareChangedFiles(files, config);

  assert.match(prepared[0]?.patch ?? "", /\[REDACTED\]/);
  assert.doesNotMatch(prepared[0]?.patch ?? "", /sk-thisShouldNeverAppear/);
  assert.equal(prepared[1]?.path, "src/auth/session.ts");
  assert.equal(prepared[1]?.patch, undefined);
  assert.equal(prepared[1]?.patchOmitted, true);
}
