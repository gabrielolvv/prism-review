import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { servletValue, splitArguments } from "./template-injection.js";
import { railsParams, requestValue } from "./untrusted-input.js";

// Calls that compile text into a regular expression, and which argument holds the pattern. The
// pattern ends at the call's opening parenthesis, or after the key for a MongoDB `$regex` or a
// Django `__regex` lookup.
type Sink = { label: string; files: RegExp; call: RegExp; argument: number };

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const python = /\.py$/i;
const ruby = /\.(?:rb|erb|rake)$/i;
const java = /\.(?:java|kt)$/i;

const sinks: Sink[] = [
  { label: "RegExp", files: javascript, call: /(?<![\w$.])(?:new\s+)?RegExp\s*\(/g, argument: 0 },
  { label: "re", files: python, call: /\b(?:re|regex)\.(?:compile|match|search|fullmatch|findall|finditer|sub|subn|split)\s*\(/g, argument: 0 },
  { label: "Django __regex", files: python, call: /\b\w+__i?regex\s*=\s*/g, argument: 0 },
  { label: "Regexp.new", files: ruby, call: /\bRegexp\.(?:new|compile)\s*\(/g, argument: 0 },
  { label: "Pattern.compile", files: java, call: /\bPattern\.(?:compile|matches)\s*\(/g, argument: 0 },
  // String's `matches`, `replaceAll`, `replaceFirst`, and `split` read their first argument as a pattern.
  { label: "String.matches", files: java, call: /\.(?:matches|replaceAll|replaceFirst|split)\s*\(/g, argument: 0 },
  { label: "Regex", files: /\.kt$/i, call: /(?<![\w.])(?:Regex|toRegex)\s*\(/g, argument: 0 },
  { label: "new Regex", files: /\.cs$/i, call: /\bnew\s+Regex\s*\(/g, argument: 0 },
  { label: "Regex.IsMatch", files: /\.cs$/i, call: /\bRegex\.(?:IsMatch|Match|Matches|Replace|Split)\s*\(/g, argument: 1 },
  { label: "preg_match", files: /\.php$/i, call: /\bpreg_(?:match|match_all|replace|replace_callback|split|grep)\s*\(/g, argument: 0 },
  // MongoDB's `$regex`, in any driver, runs the pattern on the database server.
  { label: "$regex", files: /\.(?:[cm]?[jt]sx?|py|php|rb)$/i, call: /["']?\$regex["']?\s*(?::|=>)\s*/g, argument: 0 }
];

// Escaping turns the value into a pattern that matches its own text.
const escaped =
  /\bescape\w*Reg\w*\s*\(|\bescapeRegex\w*\s*\(|\bescapeStringRegexp\s*\(|\b(?:re|regex)\.escape\s*\(|\bPattern\.quote\s*\(|\bpreg_quote\s*\(|\bRegexp\.(?:escape|quote)\s*\(|\bRegex\.Escape\s*\(|\bRegExp\.escape\s*\(|\b_\.escapeRegExp\s*\(|\bquote_?meta\s*\(/i;

// A name assigned from the request, as in `q = request.args.get("q")` or `const { search } = req.query`.
const assignment = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
// How far, in lines, a name assigned from the request is followed.
const reach = 30;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const regexInjectionRule: Rule = {
  id: "regex-injection",
  description: "Flags regular expressions compiled from request input without escaping it.",
  run({ files, config }) {
    if (!config.rules.regexInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSinks = sinks.filter((sink) => sink.files.test(file.path));
      if (
        fileSinks.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = findPatterns(file.patch, file.path, fileSinks);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "regex-injection",
          title: "Regular expression built from request input",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compile regular expressions" : "compiles a regular expression"} from a request value without escaping it, so a request can send a pattern such as \`(a+)+$\` that takes exponential time to fail (ReDoS), or \`.*\` that matches every record.`,
          recommendation:
            "Escape the value before it goes into the pattern, with `escapeRegExp` or `RegExp.escape` in JavaScript, `re.escape` in Python, `Regexp.escape` in Ruby, `Pattern.quote` in Java, `Regex.Escape` in C#, or `preg_quote` in PHP, or match it as plain text with `includes`, `in`, or a `$eq` filter."
        }
      ];
    });
  }
};

function findPatterns(patch: string, path: string, fileSinks: Sink[]): number[] {
  const isRuby = ruby.test(path);
  const isJava = java.test(path);
  const fromRequest = (text: string) =>
    requestValue.test(text) || (isRuby && railsParams.test(text)) || (isJava && servletValue.test(text));
  // Names assigned from the request, with the line they were assigned on.
  const tainted = new Map<string, number>();
  const found: number[] = [];

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const isTainted = (text: string) =>
      !escaped.test(text) &&
      (fromRequest(text) ||
        [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text)));

    if (added) {
      const reported = fileSinks.some((sink) =>
        [...content.matchAll(sink.call)].some((match) =>
          isTainted(splitArguments(content.slice(match.index + match[0].length))[sink.argument] ?? "")
        )
      );
      // Ruby interpolates values into regular expression literals: `/#{params[:q]}/` or `%r{#{q}}`.
      const literal = isRuby && [...content.matchAll(/(?:%r\{|(?<![\w)\]}])\/)[^/\n]*#\{([^}]*)\}/g)].some((match) => isTainted(match[1] ?? ""));
      if (reported || literal) {
        found.push(line);
      }
    }

    const names = destructuring.exec(content);
    if (names !== null && fromRequest(names[2] ?? "")) {
      for (const part of (names[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== undefined) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment.exec(content);
    if (single !== null && single[1] !== undefined) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  }
  return [...new Set(found)];
}
