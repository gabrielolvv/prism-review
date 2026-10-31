import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Language = {
  files: RegExp;
  markers: Array<[string, RegExp]>;
  // Lines where a marker can only turn off one kind of check, as the language's tools use it.
  exempt?: (line: PatchLine, label: string, closesString: boolean) => boolean;
};

// Each marker is a suppression that names no rule, so it silences every check in its scope.
// Targeted forms such as `eslint-disable-next-line no-console` or `# noqa: E501` do not match.
// Markers only apply to files of their own language, so `"#noqa"` inside a URL in a .ts file
// is not mistaken for a Python suppression.
const noqa = /#\s*(?:(?:flake8|ruff):\s*)?noqa\b(?!\s*:)/i;
const importLine = /^\s*(?:from\s+[\w.]+\s+)?import\s/;

// An import can only fail as an import: a bare `# noqa` there re-exports a name (F401) or keeps an
// import below code (E402), and a bare `# type: ignore` covers a module without type stubs. A `# noqa`
// after text in a comment, or on the line that closes a long string, can only cover the line's length
// (E501). `# flake8: noqa` and a `# type: ignore` on a line of its own turn off the whole file, and are
// still reported.
function pythonExempt({ content }: PatchLine, label: string, closesString: boolean): boolean {
  if (importLine.test(content)) {
    return true;
  }
  if (label !== "flake8 or Ruff") {
    return false;
  }
  const marker = noqa.exec(content);
  if (marker === null || /(?:flake8|ruff)\s*:\s*noqa/i.test(marker[0])) {
    return false;
  }
  const comment = /^\s*#/.exec(content);
  return closesString || (comment !== null && content.slice(comment[0].length, marker.index).trim() !== "");
}

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
      ["flake8 or Ruff", noqa],
      ["Python type checker", /#\s*type:\s*ignore\b(?!\[)|#\s*mypy:\s*ignore-errors\b/],
      ["Pylint", /#\s*pylint:\s*disable\s*=\s*all\b/]
    ],
    exempt: pythonExempt
  },
  { files: /\.go$/, markers: [["golangci-lint", /\/\/\s*nolint\b(?!:)/]] },
  {
    files: /\.cs$/,
    markers: [
      // Codes after `disable` make it targeted; a trailing comment alone does not.
      ["C# compiler", /^\s*#pragma\s+warning\s+disable\s*(?:$|\/\/)/],
      ["ReSharper", /\/\/\s*ReSharper\s+disable\s+All\b/]
    ]
  },
  { files: /\.swift$/, markers: [["SwiftLint", /\/\/\s*swiftlint:disable(?::next|:this|:previous)?\s+all\b/]] },
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
      [
        "PHP_CodeSniffer",
        /\bphpcs:ignoreFile\b|\bphpcs:(?:ignore|disable)\b(?!\s+[\w.]+)|@codingStandardsIgnore(?:File|Line|Start)\b/
      ],
      ["Psalm", /@psalm-suppress\s+all\b/i]
    ]
  },
  { files: /\.rs$/, markers: [["Rust lints", /#!?\[allow\([^)]{0,500}\b(?:warnings|clippy::all)\b[^)]{0,500}\)\]/]] }
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

      const found = findMarkers(patchLines(file.patch), language);
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
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "turn" : "turns"} off lint or type checks without naming which ones (${kinds}), so new problems in ${plural ? "their" : "its"} scope go unreported.`,
          recommendation:
            "Name the specific rule being suppressed and add a short reason, or fix the underlying problem."
        }
      ];
    });
  }
};

function findMarkers(lines: PatchLine[], language: Language): Array<{ line: number; label: string }> {
  const found: Array<{ line: number; label: string }> = [];
  // Whether a triple-quoted string is open, read from the patch. At the start of a hunk it is not
  // known, so it is taken as closed and the marker is reported.
  let inString = false;
  for (const line of lines) {
    if (line.startsHunk) {
      inString = false;
    }
    const quotes = (line.content.match(/"""|'''/g) ?? []).length;
    const closesString = inString && quotes % 2 === 1;
    if (quotes % 2 === 1) {
      inString = !inString;
    }
    if (!line.added) {
      continue;
    }
    for (const [label, pattern] of language.markers) {
      if (pattern.test(line.content) && !language.exempt?.(line, label, closesString)) {
        found.push({ line: line.line, label });
      }
    }
  }
  return found;
}
