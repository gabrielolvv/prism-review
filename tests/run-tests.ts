import { testParseUnifiedDiff } from "./unit/parse-unified-diff.test.js";
import { testRenderMarkdown } from "./unit/render-markdown.test.js";
import { testDefaultRules } from "./unit/rules.test.js";

const tests = [
  ["parseUnifiedDiff parses changed files", testParseUnifiedDiff],
  ["default rules flag sensitive files and missing tests", testDefaultRules],
  ["renderMarkdown renders stable review sections", testRenderMarkdown]
] as const;

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} test(s) passed.`);
