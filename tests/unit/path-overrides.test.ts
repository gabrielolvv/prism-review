import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { prismConfigSchema } from "../../src/config/schema.js";

const query = 'cursor.execute(f"SELECT * FROM t WHERE id = {x}")';

export function testPathOverridesChangeSeverityForMatchingFiles(): void {
  const config = prismConfigSchema.parse({
    severity: { "sql-injection": "high" },
    risk: { largeDiff: { maxFiles: 1 } },
    overrides: [
      { paths: ["legacy/**"], severity: { "sql-injection": "off" } },
      { paths: ["scripts/**", "tools/*.py"], severity: { "sql-injection": "info", "large-diff": "off" } },
      // A later entry wins for the files it matches.
      { paths: ["scripts/release/**"], severity: { "sql-injection": "warning" } }
    ]
  });
  const files = ["app/db.py", "legacy/db.py", "scripts/report.py", "scripts/release/notes.py", "tools/fix.py", ".github/x.py"].map(
    (path) => file(path, [query])
  );

  const result = analyzePullRequest(files, config);
  const severities = result.findings
    .filter((finding) => finding.ruleId === "sql-injection")
    .map((finding) => [finding.file, finding.severity])
    .sort();

  assert.deepEqual(severities, [
    [".github/x.py", "high"],
    ["app/db.py", "high"],
    ["scripts/release/notes.py", "warning"],
    ["scripts/report.py", "info"],
    ["tools/fix.py", "info"]
  ]);
  // Findings about the whole pull request have no file, so path overrides leave them alone.
  assert.ok(result.findings.some((finding) => finding.ruleId === "large-diff"));
}

export function testPathOverridesRejectUnknownRulesAndEmptyPaths(): void {
  assert.throws(
    () => prismConfigSchema.parse({ overrides: [{ paths: ["legacy/**"], severity: { "sql-injectoin": "off" } }] }),
    /Unknown rule .{0,2}sql-injectoin/
  );
  assert.throws(() => prismConfigSchema.parse({ overrides: [{ paths: [], severity: { "sql-injection": "off" } }] }));
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
