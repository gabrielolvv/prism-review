import { joinPath, lockfileDirectories, lockfilesFor } from "../analysis/lockfiles.js";
import { dependencyChanges, type DependencyChange } from "../analysis/manifest-dependencies.js";
import type { Rule } from "../analysis/rule.js";

const maxListed = 3;

// A manifest whose dependencies change while the lockfile that pins them stays the same: the next
// install resolves versions nobody reviewed, or fails in CI with a frozen lockfile.
export const staleLockfileRule: Rule = {
  id: "stale-lockfile",
  description: "Flags dependency changes in a manifest whose lockfile the pull request does not update.",
  run({ files, config, changedPaths, existingLockfiles }) {
    if (!config.rules.staleLockfiles.enabled || existingLockfiles === undefined) {
      return [];
    }

    return files.flatMap((file) => {
      const names = lockfilesFor(file.path);
      const changes = names.length === 0 || file.status === "removed" ? [] : dependencyChanges([file]);
      if (changes.length === 0) {
        return [];
      }

      // The nearest directory that has one of the manifest's lockfiles on the base commit.
      const directory = lockfileDirectories(file.path).find((candidate) =>
        names.some((name) => existingLockfiles.has(joinPath(candidate, name)))
      );
      if (directory === undefined || names.some((name) => changedPaths.has(joinPath(directory, name)))) {
        return [];
      }

      const lockfile = names.map((name) => joinPath(directory, name)).find((path) => existingLockfiles.has(path)) ?? "";
      const lines = changes.flatMap((change) => (change.line === undefined ? [] : [change.line]));
      const listed = changes.slice(0, maxListed).map(describe).join(", ");
      const more = changes.length > maxListed ? ` and ${changes.length - maxListed} more` : "";
      return [
        {
          ruleId: "stale-lockfile",
          title: "Lockfile not updated",
          severity: "warning" as const,
          file: file.path,
          ...(lines.length > 0 ? { line: Math.min(...lines), lines } : {}),
          message: `This file changes dependencies (${listed}${more}), but ${lockfile}, which pins the versions that are installed, is not part of this pull request.`,
          recommendation:
            "Run the package manager's install or lock command and commit the updated lockfile, so CI and other developers install the reviewed versions."
        }
      ];
    });
  }
};

function describe(change: DependencyChange): string {
  if (change.from === undefined) {
    return `${change.name} added`;
  }
  return change.to === undefined ? `${change.name} removed` : `${change.name} changed`;
}
