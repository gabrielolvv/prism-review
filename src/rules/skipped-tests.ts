import { minimatch } from "minimatch";
import { matchAddedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Marker = "focused" | "skipped";

type Language = {
  files: RegExp;
  markers: Array<[Marker, RegExp]>;
  // Most markers only count in files matched by rules.missingTests.testGlobs.
  anyFile?: boolean;
};

// JavaScript markers must not follow a `.`, so calls such as `chart.fit(...)` do not count.
const notMember = String.raw`(?<![.\w$])`;

const languages: Language[] = [
  {
    // Jest, Vitest, Mocha, Jasmine, and node:test.
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    markers: [
      ["focused", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.only(?:\.each)?\s*[(\x60]`)],
      ["focused", new RegExp(String.raw`${notMember}(?:fdescribe|fit)\s*\(`)],
      ["skipped", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.skip(?:\.each)?\s*[(\x60]`)],
      ["skipped", new RegExp(String.raw`${notMember}(?:xdescribe|xcontext|xit|xtest)\s*\(`)]
    ]
  },
  {
    // pytest and unittest, including conditional skips.
    files: /\.pyi?$/,
    markers: [
      ["skipped", /@(?:pytest\.mark\.skip(?:if)?|unittest\.skip(?:If|Unless)?)\b/],
      ["skipped", /\bpytest\.skip\s*\(/]
    ]
  },
  {
    // t.Skip, b.Skip, s.T().Skip, and their f and Now variants.
    files: /\.go$/,
    markers: [["skipped", /\.Skip(?:f|Now)?\s*\(/]]
  },
  {
    // `#[ignore]` only applies to tests, and Rust keeps unit tests inside source files.
    files: /\.rs$/,
    markers: [["skipped", /#\[ignore\b/]],
    anyFile: true
  },
  {
    // RSpec and Minitest. RSpec blocks take no parentheses, so markers start the line.
    files: /\.rb$/,
    markers: [
      ["focused", /^\s*f(?:it|describe|context|specify|example|scenario|feature)\b(?!\s*=)|\bfocus:\s*true\b|,\s*:focus\b/],
      ["skipped", /^\s*x(?:it|describe|context|specify|example|scenario|feature)\b(?!\s*=)|^\s*(?:skip|pending)\b(?!\s*[=:.])/]
    ]
  },
  {
    // JUnit 4 and 5, and TestNG.
    files: /\.(?:java|kt)$/,
    markers: [["skipped", /^\s*@(?:Disabled|Ignore)\b|@Test\s*\(\s*enabled\s*=\s*false\b/]]
  },
  {
    // PHPUnit and Pest.
    files: /\.php$/,
    markers: [
      ["focused", /->only\s*\(\s*\)/],
      ["skipped", /\$this->markTest(?:Skipped|Incomplete)\s*\(|->skip\s*\(/]
    ]
  }
];

export const skippedTestsRule: Rule = {
  id: "skipped-tests",
  description: "Flags tests that a pull request focuses or skips.",
  run({ files, config }) {
    if (!config.rules.skippedTests.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files
      .filter((file) => file.patch !== undefined)
      .flatMap((file) => {
        const isTestFile = testGlobs.some((glob) => minimatch(file.path, glob));
        const markers = languages
          .filter((language) => language.files.test(file.path) && (isTestFile || language.anyFile))
          .flatMap((language) => language.markers);
        const found = matchAddedLines(file.patch ?? "", markers).map(({ line, label }) => ({
          line,
          marker: label
        }));
        if (found.length === 0) {
          return [];
        }

        const focused = found.filter((match) => match.marker === "focused").map((match) => match.line);
        const skipped = found.filter((match) => match.marker === "skipped").map((match) => match.line);

        return [
          {
            ruleId: "skipped-tests",
            title: focused.length > 0 ? "Focused test added" : "Skipped test added",
            severity: "warning" as const,
            file: file.path,
            line: Math.min(...found.map((match) => match.line)),
            message: [
              focused.length > 0 ? describeFocused(focused) : "",
              skipped.length > 0 ? describeSkipped(skipped) : ""
            ]
              .filter(Boolean)
              .join(" "),
            recommendation:
              "Remove focus markers before merging. If a test is skipped on purpose, explain why and link the issue that tracks re-enabling it."
          }
        ];
      });
  }
};

function describeFocused(lines: number[]): string {
  const { text, plural } = describeLines(lines);
  return `${text} ${plural ? "focus tests" : "focuses a test"}, so the runner skips the other tests in scope.`;
}

function describeSkipped(lines: number[]): string {
  const { text, plural } = describeLines(lines);
  return plural
    ? `${text} skip tests, so they can stop running without failing.`
    : `${text} skips a test, so it can stop running without failing.`;
}
