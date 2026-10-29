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
  // The dependencies a line declares. `section` is the current TOML table or go.mod block.
  entries: (content: string, section: string) => Entry[];
  // The section a line opens or closes, if any, given the current one; TOML table headers by default.
  section?: (content: string, current: string) => string | undefined;
  // Reads the whole patch instead of line by line, for formats that spread one dependency over
  // several lines.
  parse?: (patch: string) => { added: DeclaredDependency[]; removed: DeclaredDependency[] };
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
// The package.json objects that list dependencies. pnpm's `overrides` sits inside `pnpm`, so it is
// matched by its own name.
const npmDependencySections = new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions"
]);
// npm keys whose values look like versions but are not dependencies, such as `engines.node` or
// `publishConfig.tag` and `publishConfig.registry`.
const npmFields = new Set(["version", "node", "npm", "tag", "registry"]);
// Package metadata whose values are URLs, which npm also accepts as dependency versions. Popular
// packages have some of these names, such as `url`, so they count inside a dependencies object.
const npmMetadataFields = new Set(["url", "homepage", "repository", "bugs", "funding"]);
// A line that opens an object or array written over several lines, such as `"dependencies": {` or a
// bare `{` in an array, and one that closes it.
const npmOpen = /^\s*(?:"([^"]{1,214})"\s*:\s*)?[{[]\s*$/;
const npmClose = /^\s*[}\]]\s*,?\s*$/;
const npmVersion = /^(?:[\^~<>=]{0,2}\s?v?\d|\*$|x$|latest$|next$|npm:|workspace:|file:|link:|git[+:]|github:|https?:)/i;
// npm names may have a scope, such as `@types/node`.
const npmEntry = new RegExp(`^\\s*"((?:@${packageName}\\/)?${packageName})"\\s*:\\s*"([^"]{0,200})"`);
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
const hunkHeader = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.{0,300})/;
const goModule = "[A-Za-z0-9][A-Za-z0-9._~/-]{0,250}";
const goRequireLine = new RegExp(`^\\s*require\\s+(${goModule})\\s+(v\\S{1,100})`);
const goBlockEntry = new RegExp(`^\\s*(${goModule})\\s+(v\\S{1,100})`);
const composerEntry = /^\s*"([a-z0-9][a-z0-9_.-]{0,100}\/[a-z0-9][a-z0-9_.-]{0,100})"\s*:\s*"([^"]{0,200})"/;
const composerVersion = /^(?:[\^~<>=!]{0,2}\s?v?\d|\*$|dev-|@)/i;
const nugetTag = /<\s*(?:PackageReference|PackageVersion|GlobalPackageReference)\b([^>]{0,500})/i;
const nugetName = /\b(?:Include|Update)\s*=\s*"([A-Za-z0-9_.-]{1,200})"/i;
const nugetVersion = /\bVersion(?:Override)?\s*=\s*"([^"]{0,100})"/i;
const packagesConfigTag = /<\s*package\b([^>]{0,500})/i;
const gradleConfiguration =
  "(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|androidTestImplementation|debugImplementation|releaseImplementation|annotationProcessor|kapt|ksp|classpath|compile|testCompile|runtime)";
const gradleCoordinate = new RegExp(
  `^\\s*${gradleConfiguration}\\s*\\(?\\s*(?:(?:platform|enforcedPlatform)\\s*\\(\\s*)?["']([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})(?::([^"'@\\s]{1,100}))?(?:@\\w{1,20})?["']`
);
const gradleMap = new RegExp(
  `^\\s*${gradleConfiguration}\\s*\\(?\\s*group\\s*[:=]\\s*["']([A-Za-z0-9_.-]{1,200})["']\\s*,\\s*name\\s*[:=]\\s*["']([A-Za-z0-9_.-]{1,200})["'](?:\\s*,\\s*version\\s*[:=]\\s*["']([^"']{1,100})["'])?`
);
const catalogEntry = /^\s*[A-Za-z0-9_.-]{1,100}\s*=\s*(.{1,400})$/;
const goBlockStart = /^\s*(require|replace|exclude|retract)\s*\(\s*(?:\/\/.*)?$/;

const manifests: Manifest[] = [
  {
    ecosystem: "npm",
    files: /(?:^|\/)package\.json$/,
    // `"name": "version"` in a dependencies object. The section holds the keys of the objects and
    // arrays a line is in, one per line, with "" for those without a key, as far as the hunk shows.
    entries(content, section) {
      const [matched, name = "", version = ""] = npmEntry.exec(content) ?? [];
      if (matched === undefined || npmFields.has(name) || !npmVersion.test(version)) {
        return [];
      }
      const enclosing = section.split("\n").filter(Boolean).at(-1);
      if (enclosing === undefined) {
        return npmMetadataFields.has(name) ? [] : [{ name, version }];
      }
      return npmDependencySections.has(enclosing) ? [{ name, version }] : [];
    },
    section(content, current) {
      const opened = npmOpen.exec(content);
      if (opened) {
        return current === "" ? `\n${opened[1] ?? ""}` : `${current}\n${opened[1] ?? ""}`;
      }
      return npmClose.test(content) ? current.slice(0, Math.max(0, current.lastIndexOf("\n"))) : undefined;
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
    ecosystem: "Packagist",
    files: /(?:^|\/)composer\.json$/,
    // `"vendor/name": "^1.0"`; platform requirements such as `php` and `ext-json` have no vendor.
    entries(content) {
      const [matched, name = "", version = ""] = composerEntry.exec(content) ?? [];
      return matched !== undefined && composerVersion.test(version) ? [{ name, version }] : [];
    }
  },
  {
    ecosystem: "NuGet",
    files: /(?:^|\/)(?:[^/]+\.(?:cs|fs|vb)proj|Directory\.(?:Packages|Build)\.props)$/i,
    // `<PackageReference Include="Name" Version="1.0" />`, on one line; a version given as a child
    // element is read as none.
    entries(content) {
      const attributes = nugetTag.exec(content)?.[1];
      const name = attributes === undefined ? undefined : nugetName.exec(attributes)?.[1];
      return name === undefined ? [] : [{ name, version: nugetVersion.exec(attributes ?? "")?.[1] ?? "" }];
    }
  },
  {
    ecosystem: "NuGet",
    files: /(?:^|\/)packages\.config$/i,
    entries(content) {
      const attributes = packagesConfigTag.exec(content)?.[1] ?? "";
      const name = /\bid\s*=\s*"([A-Za-z0-9_.-]{1,200})"/i.exec(attributes)?.[1];
      return name === undefined ? [] : [{ name, version: /\bversion\s*=\s*"([^"]{0,100})"/i.exec(attributes)?.[1] ?? "" }];
    }
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)pom\.xml$/,
    entries: () => [],
    parse: mavenDependencies
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)build\.gradle(?:\.kts)?$/,
    // `implementation("group:artifact:1.0")`, `implementation 'group:artifact:1.0'`, `platform(...)`,
    // and `implementation group: 'g', name: 'a', version: '1.0'`.
    entries(content) {
      const [matched, group = "", artifact = "", version = ""] = gradleCoordinate.exec(content) ?? gradleMap.exec(content) ?? [];
      return matched === undefined ? [] : [{ name: `${group}:${artifact}`, version }];
    }
  },
  {
    ecosystem: "Maven",
    files: /(?:^|\/)libs\.versions\.toml$/,
    // `[libraries]` entries: `"group:artifact:1.0"`, or a table with `module` or `group` and `name`,
    // and a `version`; a `version.ref` names a `[versions]` entry and reads as no version.
    entries(content, section) {
      const value = section === "libraries" ? catalogEntry.exec(content)?.[1] : undefined;
      if (value === undefined) {
        return [];
      }
      const short = /^"([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})(?::([^"]{1,100}))?"/.exec(value);
      const module = /\bmodule\s*=\s*"([A-Za-z0-9_.-]{1,200}):([A-Za-z0-9_.-]{1,200})"/.exec(value);
      const group = /\bgroup\s*=\s*"([A-Za-z0-9_.-]{1,200})"/.exec(value)?.[1];
      const name = /\bname\s*=\s*"([A-Za-z0-9_.-]{1,200})"/.exec(value)?.[1];
      const version = /\bversion\s*=\s*"([^"]{1,100})"/.exec(value)?.[1] ?? "";
      if (short) {
        return [{ name: `${short[1]}:${short[2]}`, version: short[3] ?? "" }];
      }
      if (module) {
        return [{ name: `${module[1]}:${module[2]}`, version }];
      }
      return group !== undefined && name !== undefined ? [{ name: `${group}:${name}`, version }] : [];
    }
  },
  {
    ecosystem: "Go",
    files: /(?:^|\/)go\.mod$/,
    // `require path v1.2.3`, or `path v1.2.3` inside a `require (` block; `replace` and `exclude`
    // blocks name modules too, but not dependencies.
    entries(content, section) {
      const [matched, name = "", version = ""] = goRequireLine.exec(content) ?? (section === "require" ? goBlockEntry.exec(content) : null) ?? [];
      return matched === undefined ? [] : [{ name, version }];
    },
    section: (content) => goBlockStart.exec(content)?.[1] ?? (/^\s*\)\s*$/.test(content) ? "" : undefined)
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
  if (manifest.parse !== undefined) {
    return manifest.parse(patch);
  }

  let oldLine: number | undefined;
  let newLine = 0;
  const sectionOf = manifest.section ?? ((content: string) => tableHeader.exec(content)?.[1]?.trim());
  // The old and new files each have their own sections: a removed `"dependencies": {` does not
  // enclose the lines added after it.
  let oldSection = "";
  let newSection = "";
  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      // Git shows the enclosing line after `@@`, such as `require (` for a hunk inside a go.mod block.
      oldSection = newSection = sectionOf(header[3] ?? "", "") ?? "";
      continue;
    }
    // Lines before the first hunk are git headers such as `+++ b/path`.
    if (oldLine === undefined || line.startsWith("\\")) {
      continue;
    }

    const content = line.slice(1);
    if (line.startsWith("+")) {
      newSection = sectionOf(content, newSection) ?? newSection;
      added.push(...manifest.entries(content, newSection).map((entry) => ({ ...entry, line: newLine })));
      newLine += 1;
    } else if (line.startsWith("-")) {
      oldSection = sectionOf(content, oldSection) ?? oldSection;
      removed.push(...manifest.entries(content, oldSection).map((entry) => ({ ...entry, line: oldLine ?? 0 })));
      oldLine += 1;
    } else {
      newSection = sectionOf(content, newSection) ?? newSection;
      oldSection = sectionOf(content, oldSection) ?? oldSection;
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
// in lowercase, and Go module paths without their major version suffix.
export function normalizePackageName(name: string, ecosystem: Ecosystem): string {
  const lower = name.toLowerCase();
  if (ecosystem === "PyPI") {
    return lower.replace(/[-_.]+/g, "-");
  }
  // A Go module's major version suffix, such as `/v5` or gopkg.in's `.v3`, names the same project.
  return ecosystem === "Go" ? lower.replace(/\/v\d+$/, "").replace(/^(gopkg\.in\/.+)\.v\d+$/, "$1") : lower;
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

type HunkLine = { kind: " " | "+" | "-"; content: string; oldLine: number; newLine: number };

// In a pom.xml, a `<dependency>` spreads its group, artifact, and version over several lines, and a
// version bump changes only one of them. Each hunk is read as its old and its new text, and a block
// counts as removed or added only when one of its lines changed, so unchanged dependencies in the
// context are not reported. A block cut off by the start of a hunk is read from what is shown.
function mavenDependencies(patch: string): { added: DeclaredDependency[]; removed: DeclaredDependency[] } {
  const added: DeclaredDependency[] = [];
  const removed: DeclaredDependency[] = [];

  for (const hunk of hunksOf(patch)) {
    added.push(...dependencyBlocks(hunk, "+"));
    removed.push(...dependencyBlocks(hunk, "-"));
  }
  return { added, removed };
}

function hunksOf(patch: string): HunkLine[][] {
  const hunks: HunkLine[][] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      hunks.push([]);
      continue;
    }
    const hunk = hunks[hunks.length - 1];
    const kind = line[0];
    if (hunk === undefined || (kind !== " " && kind !== "+" && kind !== "-")) {
      continue;
    }
    hunk.push({ kind, content: line.slice(1), oldLine, newLine });
    if (kind !== "+") {
      oldLine += 1;
    }
    if (kind !== "-") {
      newLine += 1;
    }
  }
  return hunks;
}

// The `side` text is the context with that side's lines. A block counts as changed when any line in
// it changed on either side, so a removed `<version>` line still marks the block in the new text.
function dependencyBlocks(lines: HunkLine[], side: "+" | "-"): DeclaredDependency[] {
  const found: DeclaredDependency[] = [];
  let block: HunkLine[] = [];
  for (const line of lines) {
    const shown = line.kind === " " || line.kind === side;
    if (shown && /<dependency\b[^>]{0,100}>/.test(line.content)) {
      block = [];
    }
    block.push(line);
    if (!shown || !/<\/dependency\s*>/.test(line.content)) {
      continue;
    }

    const text = block
      .filter((entry) => entry.kind === " " || entry.kind === side)
      .map((entry) => entry.content)
      .join(" ");
    const group = /<groupId>\s*([^<\s]{1,200})\s*<\/groupId>/.exec(text)?.[1];
    const artifact = /<artifactId>\s*([^<\s]{1,200})\s*<\/artifactId>/.exec(text)?.[1];
    const changed = block.find((entry) => entry.kind !== " ");
    if (group !== undefined && artifact !== undefined && changed !== undefined) {
      const version = /<version>\s*([^<\s]{1,100})\s*<\/version>/.exec(text)?.[1] ?? "";
      found.push({ name: `${group}:${artifact}`, version, line: side === "+" ? changed.newLine : changed.oldLine });
    }
    block = [];
  }
  return found;
}
