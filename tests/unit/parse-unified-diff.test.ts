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
