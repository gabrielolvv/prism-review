import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema, type PrismConfig } from "../../src/config/schema.js";
import { findLockfiles } from "../../src/github/load-lockfiles.js";

const addAxios = ["@@ -10,3 +10,4 @@", '   "dependencies": {', '+    "axios": "^1.6.0",', '     "yaml": "^2.8.0"'];

export function testStaleLockfileReportsManifestsWithoutTheirLockfile(): void {
  const findings = staleFindings([manifest("package.json", addAxios)], ["package-lock.json"]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.file, "package.json");
  assert.deepEqual(findings[0]?.lines, [11]);
  assert.equal(
    findings[0]?.message,
    "This file changes dependencies (axios added), but package-lock.json, which pins the versions that are installed, is not part of this pull request."
  );

  // In a workspace, the root lockfile pins every package; the nearest lockfile is the one that counts.
  const workspace = staleFindings([manifest("packages/web/package.json", addAxios)], ["pnpm-lock.yaml"]);
  assert.match(workspace[0]?.message ?? "", /but pnpm-lock\.yaml, which pins/);
  const nearest = staleFindings(
    [manifest("packages/web/package.json", addAxios), manifest("package-lock.json", ["@@ -1 +1 @@", "-a", "+b"])],
    ["package-lock.json", "packages/web/yarn.lock"]
  );
  assert.match(nearest[0]?.message ?? "", /but packages\/web\/yarn\.lock, which pins/);
}

export function testStaleLockfileAcceptsUpdatedOrMissingLockfiles(): void {
  const updated = [manifest("package.json", addAxios), manifest("package-lock.json", ["@@ -1 +1 @@", "-a", "+b"])];
  assert.deepEqual(staleFindings(updated, ["package-lock.json"]), []);
  // A lockfile left out by ignorePaths still counts as updated.
  assert.deepEqual(staleFindings(updated, ["package-lock.json"], prismConfigSchema.parse({ ignorePaths: ["package-lock.json"] })), []);
  // A new lockfile added with the manifest counts too.
  assert.deepEqual(
    staleFindings([manifest("Cargo.toml", ["@@ -1,2 +1,3 @@", " [dependencies]", '+serde = "1"']), manifest("Cargo.lock", ["@@ -0,0 +1 @@", "+x"])], []),
    []
  );

  // Without a lockfile on the base commit, or without a way to look, nothing is reported.
  assert.deepEqual(staleFindings([manifest("package.json", addAxios)], []), []);
  assert.deepEqual(
    analyzePullRequest([manifest("package.json", addAxios)], defaultConfig).findings.filter((finding) => finding.ruleId === "stale-lockfile"),
    []
  );
  // Manifests that pin themselves, describe libraries, or only change their own version are fine.
  assert.deepEqual(
    staleFindings(
      [
        manifest("requirements.txt", ["@@ -0,0 +1 @@", "+requests==2.31.0"]),
        manifest("my.gemspec", ["@@ -0,0 +1 @@", '+  spec.add_dependency "rails"']),
        manifest("sub/package.json", ["@@ -1 +1 @@", '-  "version": "1.0.0",', '+  "version": "1.1.0",'])
      ],
      ["package-lock.json", "sub/package-lock.json", "Gemfile.lock"]
    ),
    []
  );
  const off = prismConfigSchema.parse({ rules: { staleLockfiles: { enabled: false } } });
  assert.deepEqual(staleFindings([manifest("package.json", addAxios)], ["package-lock.json"], off), []);
}

export async function testFindLockfilesListsOnlyTheDirectoriesItNeeds(): Promise<void> {
  const listed: string[] = [];
  const existing = await findLockfiles(
    [
      manifest("apps/web/package.json", addAxios),
      manifest("apps/api/package.json", addAxios),
      // No dependency change, so its directories are not listed.
      manifest("tools/cli/package.json", ["@@ -1 +1 @@", '-  "version": "1.0.0",', '+  "version": "1.1.0",']),
      manifest("src/index.ts", ["@@ -0,0 +1 @@", "+export {};"])
    ],
    async (directory) => {
      listed.push(directory);
      return directory === "" ? ["package-lock.json", "README.md", "yarn.lock.bak"] : [];
    }
  );

  assert.deepEqual(listed, ["apps/web", "apps", "", "apps/api"]);
  assert.deepEqual([...existing], ["package-lock.json"]);
}

function staleFindings(files: ChangedFile[], lockfiles: string[], config: PrismConfig = defaultConfig) {
  return analyzePullRequest(files, config, { existingLockfiles: new Set(lockfiles) }).findings.filter(
    (finding) => finding.ruleId === "stale-lockfile"
  );
}

function manifest(path: string, lines: string[]): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch: lines.join("\n")
  };
}
