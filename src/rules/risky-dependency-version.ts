import { dependencyChanges, type DependencyChange } from "../analysis/manifest-dependencies.js";
import type { Rule } from "../analysis/rule.js";
import type { Finding } from "../analysis/finding.js";
import { describeLines } from "./line-list.js";

type Problem = { line: number; kind: "older" | "open"; text: string };

const maxListed = 3;
// pip-compile input files list loose requirements on purpose and pin them in the compiled file.
const compiledInput = /\.in$/i;

export const riskyDependencyVersionRule: Rule = {
  id: "risky-dependency-version",
  description: "Flags dependencies moved to an older version or left open to any future release.",
  run({ files, config }) {
    if (!config.rules.riskyDependencyVersions.enabled) {
      return [];
    }

    const byFile = new Map<string, Problem[]>();
    for (const change of dependencyChanges(files)) {
      const problem = describeProblem(change);
      if (problem !== undefined) {
        byFile.set(change.file, [...(byFile.get(change.file) ?? []), problem]);
      }
    }

    return [...byFile].map(([file, problems]): Finding => {
      const { text, plural } = describeLines(problems.map((problem) => problem.line));
      const listed = problems.slice(0, maxListed).map((problem) => problem.text).join("; ");
      const more = problems.length > maxListed ? `; and ${problems.length - maxListed} more` : "";
      const older = problems.some((problem) => problem.kind === "older");
      return {
        ruleId: "risky-dependency-version",
        title: older ? "Dependency moved to an older version" : "Dependency version left open",
        severity: "warning",
        file,
        line: Math.min(...problems.map((problem) => problem.line)),
        lines: problems.map((problem) => problem.line),
        message: `${text} ${plural ? "change" : "changes"} dependency versions: ${listed}${more}.`,
        recommendation:
          "Check why an older version is needed, since it can bring back fixed vulnerabilities, and keep versions bounded so a new release is reviewed before it is installed."
      };
    });
  }
};

function describeProblem(change: DependencyChange): Problem | undefined {
  if (change.line === undefined || change.to === undefined) {
    return undefined;
  }

  const { from, to, name } = change;
  if (from !== undefined) {
    const before = versionNumbers(from);
    const after = versionNumbers(to);
    if (before !== undefined && after !== undefined && compareVersions(after, before) < 0) {
      return { line: change.line, kind: "older", text: `${name} from ${from} to ${to}, an older version` };
    }
    if (!compiledInput.test(change.file) && !isOpenEnded(from) && isOpenEnded(to)) {
      return { line: change.line, kind: "open", text: `${name} from ${from} to ${shown(to)}, which accepts any future release` };
    }
    return undefined;
  }

  // A new dependency with no bound at all. PyPI and RubyGems manifests often list names without a
  // version and rely on a lockfile, so only npm and Cargo wildcards count.
  if ((change.ecosystem === "npm" || change.ecosystem === "crates.io") && /^(?:\*|x|latest|next|)$/i.test(to.trim())) {
    return { line: change.line, kind: "open", text: `${name} at ${shown(to)}, which accepts any release` };
  }
  return undefined;
}

function shown(version: string): string {
  return version === "" ? "no version" : version;
}

// A requirement with no upper bound: no version, a wildcard, a tag such as `latest`, or only lower
// bounds such as `>=2.0`.
function isOpenEnded(version: string): boolean {
  const spec = version.trim();
  if (/^(?:\*|x|latest|next|)$/i.test(spec)) {
    return true;
  }
  // Cargo's `1.2` and npm's `^1.2` are bounded; only explicit lower-bound-only ranges are open.
  const parts = spec.split(/\s*,\s*|\s+(?=[<>=])/).filter(Boolean);
  return (
    parts.length > 0 &&
    !spec.includes("||") &&
    parts.every((part) => /^>=?\s*v?\d/.test(part))
  );
}

// The first version number in a requirement, such as 4.17.21 in `^4.17.21` or 2.0 in `>=2.0,<3`.
// URLs, Git and local sources, and npm aliases name no comparable version.
function versionNumbers(version: string): number[] | undefined {
  if (/:\/\/|^(?:git|file|link|workspace|npm|github)[:+]/i.test(version.trim())) {
    return undefined;
  }
  const match = /(\d{1,9})(?:\.(\d{1,9}))?(?:\.(\d{1,9}))?/.exec(version);
  return match === null ? undefined : match.slice(1).filter((part) => part !== undefined).map(Number);
}

// Compares only the parts both versions give, so Cargo's `1` after `1.0.193` is not older: it
// accepts any 1.x release.
function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
