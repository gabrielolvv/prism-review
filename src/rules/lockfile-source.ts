import type { ChangedFile } from "../analysis/changed-file.js";
import type { Rule } from "../analysis/rule.js";
import { findLockfileSources, isSourceFile, type LockfileSource } from "../security/lockfile-sources.js";
import { describeLines } from "./line-list.js";

export const lockfileSourceRule: Rule = {
  id: "lockfile-source",
  description: "Flags lockfile entries and registry settings that fetch packages from outside the allowed registries.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    const ruleConfig = config.rules.lockfileSources;
    if (!ruleConfig.enabled) {
      return [];
    }

    return files.flatMap((file) => {
      const sources = sourcesIn(file, ruleConfig.allowedSources);
      if (sources.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(sources.map((source) => source.line));
      const hosts = [...new Set(sources.flatMap((source) => source.host ?? []))];
      const modules = [...new Set(sources.flatMap((source) => source.module ?? []))];
      const parts = [
        hosts.length > 0
          ? `downloaded from ${hosts.length > 1 ? "hosts that are not allowed registries" : "a host that is not an allowed registry"} (${hosts.slice(0, 3).join(", ")}${hosts.length > 3 ? ", ..." : ""})`
          : "",
        sources.some((source) => source.kind === "insecure") ? "downloaded over plain HTTP" : "",
        sources.some((source) => source.kind === "unverified") ? "downloaded without TLS verification" : "",
        sources.some((source) => source.kind === "git") ? "installed from a Git repository" : "",
        modules.length > 0
          ? `replaced with ${modules.length > 1 ? "different modules" : "a different module"} (${modules.slice(0, 3).join(", ")}${modules.length > 3 ? ", ..." : ""})`
          : "",
        sources.some((source) => source.kind === "extra-index") ? "fetched from an extra package index" : ""
      ].filter(Boolean);
      const high = sources.some((source) => ["unlisted", "insecure", "unverified"].includes(source.kind));

      return [
        {
          ruleId: "lockfile-source",
          title: high ? "Dependency from an untrusted source" : "Dependency from outside a registry",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...sources.map((source) => source.line)),
          message: `${text} ${plural ? "add dependencies" : "adds a dependency"} ${joinParts(parts)}.`,
          recommendation:
            "Check that each URL is the package you expect. A lockfile can point a familiar package name at any tarball, and installs run its scripts. Add private registries to rules.lockfileSources.allowedSources, pin Git dependencies to a commit, prefer --index-url over --extra-index-url, and keep TLS verification on."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function sourcesIn(file: ChangedFile, allowedSources: string[]): LockfileSource[] {
  if (file.lockfileSources !== undefined) {
    return file.lockfileSources;
  }
  return file.patch === undefined || !isSourceFile(file.path) ? [] : findLockfileSources(file.path, file.patch, allowedSources);
}

function joinParts(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}` : (parts[0] ?? "");
}
