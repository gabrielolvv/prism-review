import { Minimatch } from "minimatch";

export const gitAttributesPath = ".gitattributes";

export type GeneratedFiles = { isGenerated: (path: string) => boolean };

type AttributeRule = { matcher: Minimatch; generated?: boolean; vendored?: boolean };

// Paths GitHub's Linguist treats as vendored without any attribute: dependencies copied into the
// repository, build output, and minified files. GitHub collapses them in diffs too.
const defaultVendored =
  /(?:^|\/)(?:vendor|vendors|third[-_]?party|3rd[-_]?party|node_modules|bower_components|dist)\/|[.-]min\.(?:js|css)$/i;

const maxRules = 5_000;
const maxPatternLength = 500;

// Reads the `linguist-generated` and `linguist-vendored` attributes GitHub uses to collapse files in
// diffs. Patterns follow gitattributes: one without a slash matches at any depth, one with a slash is
// anchored at the root, and a directory pattern does not reach the files in it (`vendor/**` does).
// For each attribute the last matching line wins, and `-attr`, `!attr`, or `attr=false` clears it.
export function parseGitAttributes(text: string): GeneratedFiles {
  const rules: AttributeRule[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // Comments, macro definitions, and quoted patterns are skipped.
    if (line === "" || /^(?:#|\[attr\]|")/.test(line) || rules.length >= maxRules) {
      continue;
    }
    const [pattern = "", ...attributes] = line.split(/\s+/);
    // Negative patterns are not allowed in gitattributes, and a trailing `/` never matches a file.
    if (pattern.length > maxPatternLength || pattern.startsWith("!") || pattern.endsWith("/")) {
      continue;
    }
    const rule: AttributeRule = { matcher: new Minimatch(patternGlob(pattern), { dot: true }) };
    for (const attribute of attributes) {
      const state = attributeState(attribute);
      if (state?.name === "linguist-generated") {
        rule.generated = state.set;
      } else if (state?.name === "linguist-vendored") {
        rule.vendored = state.set;
      }
    }
    if (rule.generated !== undefined || rule.vendored !== undefined) {
      rules.push(rule);
    }
  }

  return {
    isGenerated(path) {
      let generated = false;
      let vendored: boolean | undefined;
      for (const rule of rules) {
        if (rule.matcher.match(path)) {
          generated = rule.generated ?? generated;
          vendored = rule.vendored ?? vendored;
        }
      }
      // `-linguist-vendored` brings a default vendored path back, as it does on GitHub.
      return generated || (vendored ?? defaultVendored.test(path));
    }
  };
}

// The default vendored paths, for a repository without a .gitattributes.
export const defaultGeneratedFiles: GeneratedFiles = parseGitAttributes("");

function patternGlob(pattern: string): string {
  return pattern.includes("/") ? pattern.replace(/^\/+/, "") : `**/${pattern}`;
}

function attributeState(attribute: string): { name: string; set: boolean } | undefined {
  const match = /^([-!]?)([\w.-]+)(?:=(.*))?$/.exec(attribute);
  if (match === null) {
    return undefined;
  }
  const [, prefix = "", name = "", value] = match;
  return { name, set: prefix === "" && value !== "false" && value !== "0" };
}
