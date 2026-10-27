import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";

export function testGoModulesAreReadFromGoMod(): void {
  const changes = dependencyChanges([
    goMod([
      "@@ -3,8 +3,9 @@ go 1.21",
      " require (",
      "-\tgithub.com/gin-gonic/gin v1.9.1",
      "+\tgithub.com/gin-gonic/gin v1.9.0",
      "+\tgithub.com/google/uuid v1.4.0 // indirect",
      " )",
      "-require github.com/pkg/errors v0.9.1",
      " replace (",
      "+\tgithub.com/acme/fork v1.0.0 => ../fork",
      " )"
    ]),
    // A hunk that starts inside the block: git shows `require (` after `@@`.
    goMod(["@@ -10,3 +10,4 @@ require (", " \tgolang.org/x/net v0.17.0", "+\tgithub.com/go-chi/chi/v5 v5.0.10", " )"], "svc/go.mod")
  ]);

  assert.deepEqual(
    changes.map(({ file, name, from, to }) => [file, name, from, to]),
    [
      ["go.mod", "github.com/gin-gonic/gin", "v1.9.1", "v1.9.0"],
      ["go.mod", "github.com/google/uuid", undefined, "v1.4.0"],
      ["go.mod", "github.com/pkg/errors", "v0.9.1", undefined],
      ["svc/go.mod", "github.com/go-chi/chi/v5", undefined, "v5.0.10"]
    ]
  );
}

export function testGoModulesGoThroughTheDependencyRules(): void {
  const files = [
    goMod([
      "@@ -3,5 +3,7 @@",
      " require (",
      "-\tgithub.com/gin-gonic/gin v1.9.1",
      "+\tgithub.com/gin-gonic/gin v1.9.0",
      // One character off a popular module, and the same project at another major version.
      "+\tgithub.com/gin-gonlc/gin v1.9.1",
      "+\tgithub.com/go-redis/redis/v9 v9.0.0",
      "+\tgopkg.in/yaml.v1 v1.0.0",
      " )"
    ])
  ];
  const result = analyzePullRequest(files, defaultConfig, { existingLockfiles: new Set(["go.sum"]) });
  const byRule = new Map(result.findings.map((finding) => [finding.ruleId, finding]));

  assert.match(byRule.get("lookalike-dependency")?.message ?? "", /^Line 5 adds github\.com\/gin-gonlc\/gin \(like github\.com\/gin-gonic\/gin\): a name one character away from a popular Go package/);
  assert.match(byRule.get("risky-dependency-version")?.message ?? "", /github\.com\/gin-gonic\/gin from v1\.9\.1 to v1\.9\.0, an older version/);
  assert.match(byRule.get("stale-lockfile")?.message ?? "", /but go\.sum, which pins/);
  assert.match(byRule.get("dependency-risk")?.message ?? "", /Go dependency/);
}

function goMod(lines: string[], path = "go.mod"): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch: lines.join("\n")
  };
}
