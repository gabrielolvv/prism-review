import type { ChangedFile } from "../analysis/changed-file.js";
import { joinPath, lockfileDirectories, lockfilesFor } from "../analysis/lockfiles.js";
import { dependencyChanges } from "../analysis/manifest-dependencies.js";
import type { GitHubClient } from "./client.js";
import { listDirectoryFiles } from "./list-directory.js";

// Directories past this many are not listed, and their manifests are not checked.
const maxDirectories = 20;

// The lockfiles on the base commit next to, or above, each manifest whose dependencies change.
// Only those directories are listed, so a pull request that changes no dependency costs no call.
export async function findBaseLockfiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  baseSha: string,
  files: ChangedFile[]
): Promise<Set<string>> {
  return findLockfiles(files, async (directory) => listDirectoryFiles(client, owner, repo, directory, baseSha));
}

export async function findLockfiles(
  files: ChangedFile[],
  list: (directory: string) => Promise<string[]>
): Promise<Set<string>> {
  const directories = new Set<string>();
  const names = new Set<string>();
  for (const file of files) {
    const lockfiles = lockfilesFor(file.path);
    if (lockfiles.length > 0 && dependencyChanges([file]).length > 0) {
      lockfiles.forEach((name) => names.add(name));
      lockfileDirectories(file.path).forEach((directory) => directories.add(directory));
    }
  }

  const existing = new Set<string>();
  for (const directory of [...directories].slice(0, maxDirectories)) {
    for (const name of await list(directory)) {
      if (names.has(name)) {
        existing.add(joinPath(directory, name));
      }
    }
  }
  return existing;
}
