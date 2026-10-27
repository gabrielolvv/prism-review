import { minimatch } from "minimatch";

// The locations GitHub reads a CODEOWNERS file from, in the order it looks for them.
export const codeOwnersPaths = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

export type CodeOwners = { ownersOf: (path: string) => readonly string[] };

type OwnerRule = { globs: string[]; owners: string[] };

// GitHub limits the file to 3 MB; these bound the work a large one can cause.
const maxRules = 5_000;
const maxPatternLength = 500;
// `@user`, `@org/team`, or an email address. Anything else on the line is not an owner.
const ownerToken =
  /^(?:@[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\/[A-Za-z0-9._-]{1,100})?|[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63})$/;

// Follows GitHub's rules: the last matching pattern wins, a pattern with no owners leaves its files
// unowned, and lines GitHub cannot read, such as `!` negations or `[ ]` ranges, are skipped.
export function parseCodeOwners(text: string): CodeOwners {
  const rules: OwnerRule[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(?:^|\s)#.*$/, "").trim();
    if (line === "" || rules.length >= maxRules) {
      continue;
    }
    const [pattern = "", ...tokens] = line.split(/\s+/);
    if (pattern.length > maxPatternLength || pattern.startsWith("!") || /[[\]]/.test(pattern)) {
      continue;
    }
    const globs = patternGlobs(pattern);
    if (globs.length > 0) {
      rules.push({ globs, owners: tokens.filter((token) => ownerToken.test(token)) });
    }
  }

  return {
    ownersOf(path) {
      for (let index = rules.length - 1; index >= 0; index -= 1) {
        const rule = rules[index];
        if (rule?.globs.some((glob) => minimatch(path, glob, { dot: true }))) {
          return rule.owners;
        }
      }
      return [];
    }
  };
}

// A pattern without a slash matches at any depth, and one with a slash is anchored at the root. A
// pattern matches a file, or a directory and everything in it, except that a trailing `/` matches
// only directories and a final `*`, as in `docs/*`, does not reach into subdirectories.
function patternGlobs(pattern: string): string[] {
  const directoryOnly = pattern.endsWith("/");
  let glob = pattern.replace(/\/+$/, "");
  const anchored = glob.includes("/");
  glob = glob.replace(/^\/+/, "");
  if (glob === "") {
    return [];
  }
  if (!anchored) {
    glob = `**/${glob}`;
  }

  if (directoryOnly) {
    return [`${glob}/**`];
  }
  return glob.split("/").pop() === "*" ? [glob] : [glob, `${glob}/**`];
}
