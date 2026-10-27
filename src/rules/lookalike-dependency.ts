import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { popularPackages, type Ecosystem } from "../security/popular-packages.js";
import { describeLines } from "./line-list.js";

type Manifest = {
  ecosystem: Ecosystem;
  files: RegExp;
  // The dependencies an added line declares. `section` is the current TOML table.
  names: (content: string, section: string) => string[];
};

const packageName = "[A-Za-z0-9][A-Za-z0-9._-]{0,213}";
// npm keys whose values look like versions but are not dependencies, such as `engines.node`.
const npmFields = new Set(["version", "node", "npm"]);
const npmVersion = /^(?:[\^~<>=]{0,2}\s?v?\d|\*$|x$|latest$|next$|npm:|workspace:|file:|link:|git[+:]|github:|https?:)/i;
const npmEntry = new RegExp(`^\\s*"(${packageName})"\\s*:\\s*"([^"]{0,200})"`);
const requirementLine = new RegExp(`^\\s*(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*(?:[<>=!~;@#]|$)`);
const quotedRequirement = new RegExp(`"(${packageName})\\s*(?:\\[[^\\]]{0,100}\\])?\\s*(?:[<>=!~]=|[<>]|===)`, "g");
const tomlKey = new RegExp(`^\\s*"?(${packageName})"?\\s*=`);
const gemLine = new RegExp(`^\\s*(?:gem|\\w{1,50}\\.add_(?:runtime_|development_)?dependency)\\s*\\(?\\s*["'](${packageName})["']`);

const manifests: Manifest[] = [
  {
    ecosystem: "npm",
    files: /(?:^|\/)package\.json$/,
    names(content) {
      // `"name": "version"` in a dependencies object. Unscoped only: a scope belongs to its owner.
      const match = npmEntry.exec(content);
      const [, name = "", version = ""] = match ?? [];
      return match !== null && !npmFields.has(name) && npmVersion.test(version) ? [name] : [];
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$/i,
    // `name`, `name[extra]`, or `name>=1.0`; options and URLs are not package names.
    names: (content) => optionalName(requirementLine.exec(content)?.[1])
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)pyproject\.toml$/i,
    names(content, section) {
      // PEP 508 requirements with a version specifier, such as `"requests>=2.31"`, in any list.
      const requirements = [...content.matchAll(quotedRequirement)].map((match) => match[1] ?? "");
      // Poetry's `name = "^1.0"` tables.
      if (/^tool\.poetry\.(?:dependencies|dev-dependencies|group\.[^.]+\.dependencies)$/.test(section)) {
        const key = tomlKey.exec(content)?.[1];
        return [...requirements, ...optionalName(key === "python" ? undefined : key)];
      }
      return requirements;
    }
  },
  {
    ecosystem: "PyPI",
    files: /(?:^|\/)Pipfile$/,
    names: (content, section) => (/^(?:packages|dev-packages)$/.test(section) ? optionalName(tomlKey.exec(content)?.[1]) : [])
  },
  {
    ecosystem: "RubyGems",
    files: /(?:^|\/)(?:Gemfile|[^/]+\.gemspec)$/,
    names: (content) => optionalName(gemLine.exec(content)?.[1])
  },
  {
    ecosystem: "crates.io",
    files: /(?:^|\/)Cargo\.toml$/,
    names(content, section) {
      // `[dependencies]`, `[dev-dependencies]`, `[workspace.dependencies]`, `[target.'cfg(..)'.dependencies]`.
      return /(?:^|\.)(?:dev-|build-)?dependencies$/.test(section) ? optionalName(tomlKey.exec(content)?.[1]) : [];
    }
  }
];

export const lookalikeDependencyRule: Rule = {
  id: "lookalike-dependency",
  description: "Flags added dependencies named one character away from a popular package.",
  run({ files, config }) {
    const ruleConfig = config.rules.lookalikeDependencies;
    if (!ruleConfig.enabled) {
      return [];
    }
    const allowed = new Set(ruleConfig.allowed.map((name) => name.toLowerCase()));

    return files.flatMap((file) => {
      const manifest = manifests.find((candidate) => candidate.files.test(file.path));
      if (manifest === undefined || file.patch === undefined || isTestDataPath(file.path)) {
        return [];
      }

      const found = findLookalikes(manifest, file.patch, allowed);
      if (found.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(found.map((match) => match.line));
      const pairs = found
        .slice(0, 3)
        .map((match) => `${match.name} (like ${match.popular})`)
        .join(", ");
      const more = found.length > 3 ? ` and ${found.length - 3} more` : "";
      return [
        {
          ruleId: "lookalike-dependency",
          title: "Dependency named like a popular package",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "add" : "adds"} ${pairs}${more}: ${found.length > 1 ? "names" : "a name"} one character away from a popular ${manifest.ecosystem} package, a common way to slip in a malicious one.`,
          recommendation:
            "Check that each name is the package that was meant. If it is, add it to rules.lookalikeDependencies.allowed."
        }
      ];
    });
  }
};

function findLookalikes(
  manifest: Manifest,
  patch: string,
  allowed: Set<string>
): Array<{ line: number; name: string; popular: string }> {
  const popular = popularPackages[manifest.ecosystem];
  const normalized = new Map(popular.map((name) => [normalize(name, manifest.ecosystem), name]));
  const lookalikes: Array<{ line: number; name: string; popular: string }> = [];
  let section = "";

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    // TOML table headers start with `[`, which git does not show after `@@`, so a hunk starts
    // outside any known table.
    if (startsHunk) {
      section = "";
    }
    section = /^\s*\[\[?([^\]]{1,200})\]\]?\s*(?:#.*)?$/.exec(content)?.[1]?.trim() ?? section;
    if (!added) {
      continue;
    }

    for (const name of manifest.names(content, section)) {
      const key = normalize(name, manifest.ecosystem);
      if (key.length < 4 || normalized.has(key) || allowed.has(name.toLowerCase())) {
        continue;
      }
      for (const [candidate, original] of normalized) {
        if (candidate.length >= 4 && oneEditApart(key, candidate)) {
          lookalikes.push({ line, name, popular: original });
          break;
        }
      }
    }
  }

  return lookalikes;
}

function optionalName(name: string | undefined): string[] {
  return name === undefined ? [] : [name];
}

// PyPI treats `-`, `_`, and `.` alike and ignores case; other registries compare names as written,
// in lowercase.
function normalize(name: string, ecosystem: Ecosystem): string {
  const lower = name.toLowerCase();
  return ecosystem === "PyPI" ? lower.replace(/[-_.]+/g, "-") : lower;
}

// One character inserted, removed, replaced, or two neighbors swapped.
export function oneEditApart(left: string, right: string): boolean {
  if (left === right || Math.abs(left.length - right.length) > 1) {
    return false;
  }
  if (left.length === right.length) {
    const differences: number[] = [];
    for (let index = 0; index < left.length && differences.length <= 2; index += 1) {
      if (left[index] !== right[index]) {
        differences.push(index);
      }
    }
    if (differences.length === 1) {
      return true;
    }
    const [first = 0, second = 0] = differences;
    return (
      differences.length === 2 && second === first + 1 && left[first] === right[second] && left[second] === right[first]
    );
  }

  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) {
    index += 1;
  }
  return shorter.slice(index) === longer.slice(index + 1);
}
