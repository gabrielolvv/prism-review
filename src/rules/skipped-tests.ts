import { minimatch } from "minimatch";
import { matchAddedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Marker = "focused" | "skipped";

// JavaScript markers must not follow a `.`, so calls such as `chart.fit(...)` do not count.
const notMember = String.raw`(?<![.\w$])`;

const testFileMarkers: Array<[Marker, RegExp]> = [
  // Jest, Vitest, Mocha, Jasmine, and node:test.
  ["focused", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.only(?:\.each)?\s*[(\x60]`)],
  ["focused", new RegExp(String.raw`${notMember}(?:fdescribe|fit)\s*\(`)],
  ["skipped", new RegExp(String.raw`${notMember}(?:describe|context|suite|it|test)\.skip(?:\.each)?\s*[(\x60]`)],
  ["skipped", new RegExp(String.raw`${notMember}(?:xdescribe|xcontext|xit|xtest)\s*\(`)],
  // pytest and unittest, including conditional skips.
  ["skipped", /@(?:pytest\.mark\.skip(?:if)?|unittest\.skip(?:If|Unless)?)\b/],
  ["skipped", /\bpytest\.skip\s*\(/],
  // Go: t.Skip, b.Skip, s.T().Skip, and their f and Now variants.
  ["skipped", /\.Skip(?:f|Now)?\s*\(/]
];

// `#[ignore]` only applies to tests, and Rust keeps unit tests inside source files.
const rustMarker: [Marker, RegExp] = ["skipped", /#\[ignore\b/];

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
        const markers = [
          ...(testGlobs.some((glob) => minimatch(file.path, glob)) ? testFileMarkers : []),
          ...(file.path.endsWith(".rs") ? [rustMarker] : [])
        ];
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
