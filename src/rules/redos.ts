import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { ambiguousGroup } from "../analysis/regex-ambiguity.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Source = { pattern: string; raw: boolean };
type Language = { files: RegExp; find: (content: string) => Source[] };

// A regular expression literal: after a character or keyword that cannot end an expression, so a
// division such as `a / b / c` is not read as one.
const regexLiteral = /(?:^|[=(,:[!&|?{};]|\breturn|\bwhen|\bif|\bunless)\s*\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\[\n])+)\/[a-z]*/g;
// Single or double quoted text, as the first argument: the quote is group 1 and the text group 2. A
// backslash only starts an escape, so the two alternatives never match the same text.
const quoted = String.raw`(["'])((?:\\.|(?!\1)[^\\])*)\1`;

// A call with the pattern as its first or second argument: the raw-string prefix is group 1, the quote
// group 2, and the text group 3.
const regexCall = (prefix: string, rawPrefix = "") =>
  new RegExp(String.raw`${prefix}\s*\(\s*(?:[^,()]{1,200},\s*)?(${rawPrefix})?(["'])((?:\\.|(?!\2)[^\\])*)\2`, "g");

const sources = (content: string, pattern: RegExp, rawGroup: (match: RegExpMatchArray) => boolean, textGroup: number): Source[] =>
  [...content.matchAll(pattern)].map((match) => ({ pattern: match[textGroup] ?? "", raw: rawGroup(match) }));

// Go's regexp and Rust's regex crate match in linear time, so they are not read.
const languages: Language[] = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    find: (content) => [
      ...sources(content, regexLiteral, () => true, 1),
      ...sources(content, new RegExp(String.raw`\bRegExp\s*\(\s*${quoted}`, "g"), () => false, 2)
    ]
  },
  {
    files: /\.pyi?$/,
    find: (content) =>
      sources(content, regexCall(String.raw`\bre(?:gex)?\.(?:compile|match|fullmatch|search|findall|finditer|sub|subn|split)`, "[rRbB]{1,2}"), (match) => /r/i.test(match[1] ?? ""), 3)
  },
  {
    files: /\.rb$/,
    find: (content) => [
      ...sources(content, regexLiteral, () => true, 1),
      ...sources(content, new RegExp(String.raw`\bRegexp\.new\s*\(\s*${quoted}`, "g"), (match) => match[1] === "'", 2)
    ]
  },
  {
    files: /\.(?:java|kt|scala)$/,
    find: (content) =>
      sources(content, regexCall(String.raw`(?:\bPattern\.compile|\.matches|\.replaceAll|\.replaceFirst|\.split|\bRegex)`), () => false, 3)
  },
  {
    files: /\.cs$/,
    find: (content) =>
      sources(content, regexCall(String.raw`(?:\bnew\s+Regex|\bRegex\.(?:IsMatch|Match|Matches|Replace|Split))`, "@"), (match) => match[1] === "@", 3)
  },
  {
    files: /\.php$/,
    find: (content) =>
      sources(content, regexCall(String.raw`\bpreg_(?:match|match_all|replace|replace_callback|split|grep)`), (match) => match[2] === "'", 3).map(
        ({ pattern, raw }) => ({ pattern: withoutDelimiters(pattern), raw })
      )
  }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
const minified = /\.min\.(?:js|mjs|cjs)$/i;
const maxLineLength = 1_000;

export const redosRule: Rule = {
  id: "redos",
  description: "Flags regular expressions with a repeated group that can match the same text in many ways, which can take exponential time on a crafted input.",
  run({ files, config }) {
    if (!config.rules.redos.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find(({ files }) => files.test(file.path));
      if (
        language === undefined ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        minified.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = patchLines(file.patch).flatMap(({ line, content, added }) => {
        if (!added || commentLine.test(content) || content.length > maxLineLength) {
          return [];
        }
        const group = language
          .find(content)
          .map(({ pattern, raw }) => ambiguousGroup(raw ? pattern : unescapeString(pattern)))
          .find((match) => match !== undefined);
        return group === undefined ? [] : [{ line, group }];
      });
      if (found.length === 0) {
        return [];
      }

      const lines = found.map((match) => match.line);
      const { text, plural } = describeLines(lines);
      const example = found[0]?.group ?? "";
      return [
        {
          ruleId: "redos",
          title: "Regular expression open to ReDoS",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "add regular expressions" : "adds a regular expression"} with a repeated group that can match the same text in many ways, such as ${example.length > 60 ? `${example.slice(0, 57)}...` : example}, which can take exponential time on a crafted input (ReDoS).`,
          recommendation:
            "Make each repetition match text the others cannot, for example with a required separator such as (\\w+\\s)*, use an atomic group or possessive quantifier where the engine has them, limit the input length, or use a linear-time engine such as RE2."
        }
      ];
    });
  }
};

// In a quoted string, a backslash that reaches the regular expression is written twice.
function unescapeString(text: string): string {
  return text.replace(/\\\\/g, "\\");
}

// PHP patterns carry delimiters and flags, as in '/(\w+)+$/i'.
function withoutDelimiters(pattern: string): string {
  const delimiter = pattern[0];
  if (delimiter === undefined || /[\w\s\\]/.test(delimiter)) {
    return pattern;
  }
  const closing = { "(": ")", "[": "]", "{": "}", "<": ">" }[delimiter] ?? delimiter;
  const end = pattern.lastIndexOf(closing);
  return end > 0 ? pattern.slice(1, end) : pattern;
}
