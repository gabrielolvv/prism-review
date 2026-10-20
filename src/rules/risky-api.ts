import { minimatch } from "minimatch";
import { addedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Language = { files: RegExp; calls: Array<[string, RegExp]> };

// Assembled so this file does not match its own pattern.
const rawHtmlProp = ["dangerously", "SetInnerHTML"].join("");

// Each call runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML.
// Member calls such as `pattern.exec(input)` and `model.eval()` are excluded by the lookbehinds.
const languages: Language[] = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    calls: [
      ["eval", /(?<![.\w$])eval\s*\(/],
      ["Function constructor", /\bnew\s+Function\s*\(/],
      // `exe[c]` keeps this line from containing the call it describes.
      ["child_process exec", /(?<![.\w$])exe[c](?:Sync)?\s*\(|\bchild_process\.exe[c](?:Sync)?\s*\(/],
      ["shell option", /\bshell\s*:\s*true\b/],
      [rawHtmlProp, new RegExp(`\\b${rawHtmlProp}\\b`)],
      ["innerHTML assignment", /\.(?:inner|outer)HTML\s*\+?=(?!=)/],
      ["document.write", /\bdocument\.write(?:ln)?\s*\(/]
    ]
  },
  {
    files: /\.py$/,
    calls: [
      ["eval", /(?<![.\w])eval\s*\(/],
      ["exec", /(?<![.\w])exec\s*\(/],
      ["pickle", /\b(?:c?pickle|marshal|shelve)\.loads?\s*\(/],
      ["yaml.load", /\byaml\.(?:load\s*\((?![^)]*\b(?:Safe|CSafe|Base)Loader\b)|unsafe_load\s*\()/],
      ["shell=True", /\bshell\s*=\s*True\b/],
      ["os.system", /\bos\.(?:system|popen)\s*\(/]
    ]
  },
  {
    files: /\.go$/,
    calls: [
      ["shell command", /\bexec\.Command(?:Context)?\s*\((?:[^,"]*,\s*)?"(?:sh|bash|zsh|cmd)"\s*,\s*"(?:-c|\/c)"/],
      ["template.HTML", /\btemplate\.HTML\s*\(/]
    ]
  }
];

export const riskyApiRule: Rule = {
  id: "risky-api",
  description: "Flags added calls that run strings as code, start a shell, deserialize data, or write raw HTML.",
  run({ files, config }) {
    if (!config.rules.riskyApis.enabled) {
      return [];
    }

    // Tests call these on purpose, with fixed input.
    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (!language || file.patch === undefined || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const found = addedLines(file.patch).flatMap(({ line, content }) =>
        language.calls.filter(([, pattern]) => pattern.test(content)).map(([kind]) => ({ line, kind }))
      );
      if (found.length === 0) {
        return [];
      }

      const kinds = [...new Set(found.map((match) => match.kind))];
      const { text, plural } = describeLines(found.map((match) => match.line));
      const many = plural || kinds.length > 1;

      return [
        {
          ruleId: "risky-api",
          title: "Risky API call added",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          message: `${text} ${plural ? "add" : "adds"} ${many ? "calls that deserve" : "a call that deserves"} a security review: ${kinds.join(", ")}.`,
          recommendation:
            "Check that no user or pull request input reaches these calls, and prefer a safer alternative such as JSON.parse, execFile with an argument list, yaml.safe_load, or textContent."
        }
      ];
    });
  }
};
