import { addedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Each pattern matches a suppression that names no rule, so it silences every check in its scope.
// Targeted forms such as `eslint-disable-next-line no-console` or `# noqa: E501` do not match.
const suppressions: Array<[string, RegExp]> = [
  ["ESLint", /\beslint-disable(?:-next-line|-line)?(?=\s*(?:\*\/|--|$))/],
  // The directive only takes effect in a comment that starts the line.
  ["TypeScript", /^\s*(?:\/\/|\/\*+|\*)\s*@ts-nocheck\b/],
  ["flake8 or Ruff", /#\s*(?:(?:flake8|ruff):\s*)?noqa\b(?!\s*:)/i],
  ["Python type checker", /#\s*type:\s*ignore\b(?!\[)|#\s*mypy:\s*ignore-errors\b/],
  ["Pylint", /#\s*pylint:\s*disable\s*=\s*all\b/],
  ["golangci-lint", /\/\/\s*nolint\b(?!:)/],
  ["Rust lints", /#!?\[allow\([^)]*\b(?:warnings|clippy::all)\b[^)]*\)\]/]
];

// Documentation often shows these markers as examples.
const documentationFile = /\.(?:md|mdx|markdown|rst|txt|adoc)$/i;

export const blanketSuppressionRule: Rule = {
  id: "blanket-suppression",
  description: "Flags lint and type check suppressions that do not name the checks they turn off.",
  run({ files, config }) {
    if (!config.rules.blanketSuppression.enabled) {
      return [];
    }

    return files
      .filter((file) => file.patch !== undefined && !documentationFile.test(file.path))
      .flatMap((file) => {
        const found = addedLines(file.patch ?? "").flatMap(({ line, content }) =>
          suppressions.filter(([, pattern]) => pattern.test(content)).map(([kind]) => ({ line, kind }))
        );
        if (found.length === 0) {
          return [];
        }

        const { text, plural } = describeLines(found.map((match) => match.line));
        const kinds = [...new Set(found.map((match) => match.kind))].join(", ");

        return [
          {
            ruleId: "blanket-suppression",
            title: "Blanket lint suppression added",
            severity: "warning" as const,
            file: file.path,
            line: Math.min(...found.map((match) => match.line)),
            message: `${text} ${plural ? "turn" : "turns"} off lint or type checks without naming which ones (${kinds}), so new problems in ${plural ? "their" : "its"} scope go unreported.`,
            recommendation:
              "Name the specific rule being suppressed and add a short reason, or fix the underlying problem."
          }
        ];
      });
  }
};
