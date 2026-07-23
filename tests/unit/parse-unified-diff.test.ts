import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseUnifiedDiff } from "../../src/testing/parse-unified-diff.js";

export function testParseUnifiedDiff(): void {
  const diff = readFileSync("fixtures/diffs/risky-auth-change.diff", "utf8");

  const files = parseUnifiedDiff(diff);

  assert.equal(files.length, 2);
  assert.deepEqual(
    {
      path: files[0]?.path,
      status: files[0]?.status,
      additions: files[0]?.additions,
      deletions: files[0]?.deletions
    },
    {
      path: "src/auth/session.ts",
      status: "modified",
      additions: 2,
      deletions: 2
    }
  );
}

export function testParseUnifiedDiffRecordsRenameSource(): void {
  const diff = [
    "diff --git a/.prism-review.yml b/config/prism-review.yml",
    "similarity index 100%",
    "rename from .prism-review.yml",
    "rename to config/prism-review.yml"
  ].join("\n");

  const files = parseUnifiedDiff(diff);

  assert.equal(files[0]?.path, "config/prism-review.yml");
  assert.equal(files[0]?.status, "renamed");
  assert.equal(files[0]?.previousPath, ".prism-review.yml");
}
