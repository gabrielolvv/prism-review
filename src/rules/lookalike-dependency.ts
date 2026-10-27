import { declaredDependencies, manifestEcosystem, normalizePackageName } from "../analysis/manifest-dependencies.js";
import type { Rule } from "../analysis/rule.js";
import { popularPackages, type Ecosystem } from "../security/popular-packages.js";
import { describeLines } from "./line-list.js";

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
      const ecosystem = manifestEcosystem(file.path);
      if (ecosystem === undefined || file.patch === undefined) {
        return [];
      }

      const found = findLookalikes(ecosystem, declaredDependencies(file.path, file.patch).added, allowed);
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
          message: `${text} ${plural ? "add" : "adds"} ${pairs}${more}: ${found.length > 1 ? "names" : "a name"} one character away from a popular ${ecosystem} package, a common way to slip in a malicious one.`,
          recommendation:
            "Check that each name is the package that was meant. If it is, add it to rules.lookalikeDependencies.allowed."
        }
      ];
    });
  }
};

function findLookalikes(
  ecosystem: Ecosystem,
  added: Array<{ name: string; line: number }>,
  allowed: Set<string>
): Array<{ line: number; name: string; popular: string }> {
  const normalized = new Map(popularPackages[ecosystem].map((name) => [normalizePackageName(name, ecosystem), name]));
  const lookalikes: Array<{ line: number; name: string; popular: string }> = [];

  for (const { name, line } of added) {
    const key = normalizePackageName(name, ecosystem);
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

  return lookalikes;
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
