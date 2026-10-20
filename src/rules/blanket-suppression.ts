import { matchAddedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Language = { files: RegExp; markers: Array<[string, RegExp]> };

// Each marker is a suppression that names no rule, so it silences every check in its scope.
// Targeted forms such as `eslint-disable-next-line no-console` or `# noqa: E501` do not match.
// Markers only apply to files of their own language, so `"#noqa"` inside a URL in a .ts file
// is not mistaken for a Python suppression.
const languages: Language[] = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    markers: [
      ["ESLint", /\beslint-disable(?:-next-line|-line)?(?=\s*(?:\*\/|--|$))/],
      // Both directives only take effect in a comment that starts the line.
      ["TypeScript", /^\s*(?:\/\/|\/\*+|\*)\s*@ts-(?:nocheck|ignore)\b/]
    ]
  },
  {
    files: /\.pyi?$/,
    markers: [
      ["flake8 or Ruff", /#\s*(?:(?:flake8|ruff):\s*)?noqa\b(?!\s*:)/i],
      ["Python type checker", /#\s*type:\s*ignore\b(?!\[)|#\s*mypy:\s*ignore-errors\b/],
      ["Pylint", /#\s*pylint:\s*disable\s*=\s*all\b/]
    ]
  },
  { files: /\.go$/, markers: [["golangci-lint", /\/\/\s*nolint\b(?!:)/]] },
  { files: /\.(?:rb|rake)$/, markers: [["RuboCop", /#\s*rubocop:\s*(?:disable|todo)\s+all\b/]] },
  {
    files: /\.(?:java|kt)$/,
    markers: [
      ["compiler warnings", /@SuppressWarnings\(\s*(?:value\s*=\s*)?\{?\s*"all"/],
      ["Checkstyle", /\/\/\s*CHECKSTYLE:\s*OFF\b/],
      ["SonarQube", /\/\/\s*NOSONAR\b(?!\s*\()/]
    ]
  },
  {
    files: /\.php$/,
    markers: [
      // The newer `@phpstan-ignore identifier` form names what it ignores.
      ["PHPStan", /@phpstan-ignore-(?:next-)?line\b/],
      // A sniff name after the directive makes it targeted; `-- reason` alone does not.
      ["PHP_CodeSniffer", /\bphpcs:(?:ignore|disable)\b(?!\s+[\w.]+)|@codingStandardsIgnore(?:File|Line|Start)\b/],
      ["Psalm", /@psalm-suppress\s+all\b/i]
    ]
  },
  { files: /\.rs$/, markers: [["Rust lints", /#!?\[allow\([^)]*\b(?:warnings|clippy::all)\b[^)]*\)\]/]] }
];

export const blanketSuppressionRule: Rule = {
  id: "blanket-suppression",
  description: "Flags lint and type check suppressions that do not name the checks they turn off.",
  run({ files, config }) {
    if (!config.rules.blanketSuppression.enabled) {
      return [];
    }

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (!language || file.patch === undefined) {
        return [];
      }

      const found = matchAddedLines(file.patch, language.markers);
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found.map((match) => match.line));
      const kinds = [...new Set(found.map((match) => match.label))].join(", ");

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
