import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { initRepository, starterConfig, workflowPath, workflowYaml } from "../../src/cli/init.js";
import { parseConfig } from "../../src/config/load-config.js";
import { defaultConfig } from "../../src/config/schema.js";

const releaseCommit = "0123456789abcdef0123456789abcdef01234567";

function withDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "prism-review-init-"));
  return run(directory).finally(() => rmSync(directory, { recursive: true, force: true }));
}

function added(path: string, content: string): ChangedFile {
  const lines = content.replace(/\n$/, "").split("\n");
  return {
    path,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n")
  };
}

export async function testInitPinsTheReleaseCommit(): Promise<void> {
  await withDirectory(async (directory) => {
    const tags: string[] = [];
    const result = await initRepository({
      directory,
      force: false,
      version: "1.2.3",
      findReleaseCommit: async (tag) => {
        tags.push(tag);
        return releaseCommit;
      }
    });

    assert.deepEqual(tags, ["v1.2.3"]);
    assert.deepEqual(result.written, [workflowPath, ".prism-review.yml"]);
    const workflow = readFileSync(join(directory, workflowPath), "utf8");
    assert.match(workflow, new RegExp(`^      - uses: gabrielolvv/prism-review@${releaseCommit} # v1\\.2\\.3$`, "m"));
    assert.equal(readFileSync(join(directory, ".prism-review.yml"), "utf8"), starterConfig);
  });
}

export async function testInitFallsBackToTheMajorTag(): Promise<void> {
  for (const findReleaseCommit of [async () => undefined, async () => Promise.reject(new Error("offline"))]) {
    await withDirectory(async (directory) => {
      const result = await initRepository({ directory, force: false, version: "1.2.3", findReleaseCommit });
      assert.equal(result.uses, "v0");
    });
  }

  // A build from source has no release, and an explicit ref is used as given, without a lookup.
  const unexpected = async (): Promise<string> => assert.fail("looked up a release commit");
  await withDirectory(async (directory) => {
    assert.equal((await initRepository({ directory, force: false, version: "development", findReleaseCommit: unexpected })).uses, "v0");
  });
  await withDirectory(async (directory) => {
    const result = await initRepository({ directory, force: false, version: "1.2.3", ref: "v1.2.3", findReleaseCommit: unexpected });
    assert.match(readFileSync(join(directory, workflowPath), "utf8"), /prism-review@v1\.2\.3$/m);
    assert.equal(result.uses, "v1.2.3");
  });
}

export async function testInitLeavesExistingFilesUnlessForced(): Promise<void> {
  await withDirectory(async (directory) => {
    mkdirSync(join(directory, ".github/workflows"), { recursive: true });
    writeFileSync(join(directory, workflowPath), "name: Mine\n");

    const kept = await initRepository({ directory, force: false, version: "1.2.3", ref: "v0" });
    assert.deepEqual(kept.written, [".prism-review.yml"]);
    assert.deepEqual(kept.skipped, [workflowPath]);
    assert.equal(readFileSync(join(directory, workflowPath), "utf8"), "name: Mine\n");

    const forced = await initRepository({ directory, force: true, version: "1.2.3", ref: "v0" });
    assert.deepEqual(forced.written, [workflowPath, ".prism-review.yml"]);
    assert.match(readFileSync(join(directory, workflowPath), "utf8"), /^name: Prism Review$/m);
  });
}

export function testInitFilesPassTheirOwnReview(): void {
  // The pull request that adds Prism Review should not be told to fix the workflow it was given.
  const files = [added(workflowPath, workflowYaml(`${releaseCommit} # v1.2.3`)), added(".prism-review.yml", starterConfig)];
  const ruleIds = analyzePullRequest(files, defaultConfig).findings.map((finding) => finding.ruleId);

  assert.ok(!ruleIds.includes("workflow-risk"), ruleIds.join(", "));
  assert.ok(!ruleIds.includes("unpinned-action"), ruleIds.join(", "));
}

export function testStarterConfigKeepsTheDefaults(): void {
  assert.deepEqual(parseConfig(starterConfig, ".prism-review.yml"), defaultConfig);
}
