import { minimatch } from "minimatch";
import { addedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Marker = "focused" | "skipped";

const markers: Array<[Marker, RegExp]> = [
  // Jest, Vitest, Mocha, Jasmine, and node:test.
  ["focused", /\b(?:describe|context|suite|it|test)\.only(?:\.each)?\s*[(`]/],
  ["focused", /\b(?:fdescribe|fit)\s*\(/],
  ["skipped", /\b(?:describe|context|suite|it|test)\.skip(?:\.each)?\s*[(`]/],
  ["skipped", /\b(?:xdescribe|xcontext|xit|xtest)\s*\(/],
  // pytest and unittest.
  ["skipped", /@(?:pytest\.mark\.skip|unittest\.skip)\b/],
  ["skipped", /\bpytest\.skip\s*\(/],
  // Go and Rust.
  ["skipped", /\bt\.Skip(?:f|Now)?\s*\(/],
  ["skipped", /#\[ignore\b/]
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
      .filter((file) => file.patch !== undefined && testGlobs.some((glob) => minimatch(file.path, glob)))
      .flatMap((file) => {
        const found = addedLines(file.patch ?? "").flatMap(({ line, content }) =>
          markers.filter(([, pattern]) => pattern.test(content)).map(([marker]) => ({ line, marker }))
        );
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
    ? `${text} skip tests, so they no longer run.`
    : `${text} skips a test, so it no longer runs.`;
}
