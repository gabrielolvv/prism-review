import { isTestDataPath } from "./repository-path.js";
import type { ChangedFile } from "./changed-file.js";
import type { Ecosystem } from "../security/popular-packages.js";

// A dependency a manifest line declares, with its version requirement as written, or "" when the
// line gives none. `line` is in the new file for added lines and in the old file for removed ones.
export type DeclaredDependency = { name: string; version: string; line: number };

type Entry = { name: string; version: string };

type Manifest = {
  ecosystem: Ecosystem;
  files: RegExp;
  // The dependencies a line declares. `section` is the current TOML table.
  entries: (content: string, section: string) => Entry[];
};

// How a dependency changed: `from` is missing for an added one, and `to` for a removed one. `line`
// is where the new version is declared, for added and changed dependencies.
export type DependencyChange = {
  file: string;
  ecosystem: Ecosystem;
  name: string;
  from?: string;
  to?: string;
  line?: number;
};

const packageName = "[A-Za-z0-9][A-Za-z0-9._-]{0,213}";
// npm keys whose values look like versions but are not dependencies, such as `engines.node`.
const npmFields = new Set(["version", "node", "npm"]);
const npmVersion = /^(?:[\^~<>=]{0,2}\s?v?\d|\*$|x$|latest$|next$|npm:|workspace:|file:|link:|git[+:]|github:|https?:)/i;
const npmEntry = new RegExp(`^\\s*"(${packageName})"\\s*:\\s*"([^"]{0,200})"`);
const requirementLine = new RegExp(`^\\s*(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*([<>=!~][^;#]{0,100}|@[^;#]{0,200})?(?:[;#]|$)`);
const quotedRequirement = new RegExp(
  `"(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*((?:[<>=!~]=|[<>]|===)[^";]{0,100})`,
  "g"
);
const tomlEntry = new RegExp(`^\\s*"?(${packageName})"?\\s*=\\s*(.{0,300})$`);
const gemLine = new RegExp(
  `^\\s*(?:gem|\\w{1,50}\\.add_(?:runtime_|development_)?dependency)\\s*\\(?\\s*["'](${packageName})["'](?:\\s*,\\s*["']([^"']{1,100})["'])?`
);
const tableHeader = /^\s*\[\[?([^\]]{1,200})\]\]?\s*(?:#.*)?$/;
const hunkHeader = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

const manifests: Manifest[] = [
  {
    ecosystem: "npm",
    files: /(?:^|\/)package\.json$/,
    entries(content) {
      // `"name": "version"` in a dependencies object. Unscoped only: a scope belongs to its owner.
      const [matched, name = "", version = ""] = npmEntry.exec(content) ?? [];
      return matched !== undefined && !npmFields.has(name) && npmVersion.test(version) ? [{ name, version }] : [];
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$/i,
    // `name`, `name[extra]`, `name>=1.0`, or `name @ url`; options and URLs are not package names.
    entries(content) {
      const [matched, name = "", version = ""] = requirementLine.exec(content) ?? [];
      return matched === undefined ? [] : [{ name, version: version.trim() }];
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)pyproject\.toml$/i,
    entries(content, section) {
      // PEP 508 requirements with a version specifier, such as `"requests>=2.31"`, in any list.
      const requirements = [...content.matchAll(quotedRequirement)].map((match) => ({
        name: match[1] ?? "",
        version: (match[2] ?? "").trim()
      }));
      // Poetry's `name = "^1.0"` tables.
      if (/^tool\.poetry\.(?:dependencies|dev-dependencies|group\.[^.]+\.dependencies)$/.test(section)) {
        return [...requirements, ...tomlEntries(content).filter((entry) => entry.name !== "python")];
      }
      return requirements;
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)Pipfile$/,
    entries: (content, section) => (/^(?:packages|dev-packages)$/.test(section) ? tomlEntries(content) : [])
  },
  {
    ecosystem: "RubyGems",
    files: /(?:^|\/)(?:Gemfile|[^/]+\.gemspec)$/,
    entries(content) {
      const [matched, name = "", version = ""] = gemLine.exec(content) ?? [];
      return matched === undefined ? [] : [{ name, version }];
    }
  },
  {
    ecosystem: "crates.io",
    files: /(?:^|\/)Cargo\.toml$/,
    // `[dependencies]`, `[dev-dependencies]`, `[workspace.dependencies]`, `[target.'cfg(..)'.dependencies]`.
    entries: (content, section) => (/(?:^|\.)(?:dev-|build-)?dependencies$/.test(section) ? tomlEntries(content) : [])
  }
];

export function manifestEcosystem(path: string): Ecosystem | undefined {
  return manifestFor(path)?.ecosystem;
}

function manifestFor(path: string): Manifest | undefined {
  return isTestDataPath(path) ? undefined : manifests.find((manifest) => manifest.files.test(path));
}

// The dependencies a manifest's patch adds and removes. TOML table headers start with `[`, which
// git does not show after `@@`, so a hunk starts outside any known table until it shows one.
export function declaredDependencies(path: string, patch: string): { added: DeclaredDependency[]; removed: DeclaredDependency[] } {
  const manifest = manifestFor(path);
  const added: DeclaredDependency[] = [];
  const removed: DeclaredDependency[] = [];
  if (manifest === undefined) {
    return { added, removed };
  }

  let oldLine: number | undefined;
  let newLine = 0;
  let section = "";
  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      section = "";
      continue;
    }
    // Lines before the first hunk are git headers such as `+++ b/path`.
    if (oldLine === undefined || line.startsWith("\\")) {
      continue;
    }

    const content = line.slice(1);
    section = tableHeader.exec(content)?.[1]?.trim() ?? section;
    if (line.startsWith("+")) {
      added.push(...manifest.entries(content, section).map((entry) => ({ ...entry, line: newLine })));
      newLine += 1;
    } else if (line.startsWith("-")) {
      removed.push(...manifest.entries(content, section).map((entry) => ({ ...entry, line: oldLine ?? 0 })));
      oldLine += 1;
    } else {
      newLine += 1;
      oldLine += 1;
    }
  }

  return { added, removed };
}

// What the pull request does to each dependency, per manifest. A dependency that is removed and
// added again with the same version, as when lines move, did not change.
export function dependencyChanges(files: ChangedFile[]): DependencyChange[] {
  return files.flatMap((file) => {
    const ecosystem = manifestEcosystem(file.path);
    if (ecosystem === undefined || file.patch === undefined) {
      return [];
    }

    const { added, removed } = declaredDependencies(file.path, file.patch);
    const before = byName(removed, ecosystem);
    const after = byName(added, ecosystem);
    const changes: DependencyChange[] = [];
    for (const [key, dependency] of after) {
      const previous = before.get(key);
      if (previous === undefined) {
        changes.push({ file: file.path, ecosystem, name: dependency.name, to: dependency.version, line: dependency.line });
      } else if (previous.version !== dependency.version) {
        changes.push({
          file: file.path,
          ecosystem,
          name: dependency.name,
          from: previous.version,
          to: dependency.version,
          line: dependency.line
        });
      }
    }
    for (const [key, dependency] of before) {
      if (!after.has(key)) {
        changes.push({ file: file.path, ecosystem, name: dependency.name, from: dependency.version });
      }
    }
    return changes;
  });
}

function byName(dependencies: DeclaredDependency[], ecosystem: Ecosystem): Map<string, DeclaredDependency> {
  const map = new Map<string, DeclaredDependency>();
  for (const dependency of dependencies) {
    const key = normalizePackageName(dependency.name, ecosystem);
    if (!map.has(key)) {
      map.set(key, dependency);
    }
  }
  return map;
}

// PyPI treats `-`, `_`, and `.` alike and ignores case; other registries compare names as written,
// in lowercase.
export function normalizePackageName(name: string, ecosystem: Ecosystem): string {
  const lower = name.toLowerCase();
  return ecosystem === "PyPI" ? lower.replace(/[-_.]+/g, "-") : lower;
}

// `name = "1.0"`, `name = { version = "1.0", ... }`, or `name = { git = "..." }`, which has no version.
function tomlEntries(content: string): Entry[] {
  const [matched, name = "", value = ""] = tomlEntry.exec(content) ?? [];
  if (matched === undefined) {
    return [];
  }
  const version = /^"([^"]{0,100})"/.exec(value.trim())?.[1] ?? /\bversion\s*=\s*"([^"]{0,100})"/.exec(value)?.[1] ?? "";
  return [{ name, version }];
}
