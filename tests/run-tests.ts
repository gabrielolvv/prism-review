import { testParseUnifiedDiff } from "./unit/parse-unified-diff.test.js";
import {
  testRedactChangedFilesDoesNotMutateOriginal,
  testRedactSecrets
} from "./unit/redact-secrets.test.js";
import {
  testRenderMarkdown,
  testRenderMarkdownHidesLowSeverityByDefault,
  testRenderMarkdownIncludesLowSeverityWhenEnabled
} from "./unit/render-markdown.test.js";
import { testDefaultRules, testDependencyRiskRule } from "./unit/rules.test.js";

const tests = [
  ["parseUnifiedDiff parses changed files", testParseUnifiedDiff],
  ["default rules flag sensitive files and missing tests", testDefaultRules],
  ["dependency risk rule flags manifest and lockfile changes", testDependencyRiskRule],
  ["redactSecrets masks token-like values", testRedactSecrets],
  ["redactChangedFiles does not mutate original files", testRedactChangedFilesDoesNotMutateOriginal],
  ["renderMarkdown renders stable review sections", testRenderMarkdown],
  ["renderMarkdown hides info findings by default", testRenderMarkdownHidesLowSeverityByDefault],
  [
    "renderMarkdown includes info findings when enabled",
    testRenderMarkdownIncludesLowSeverityWhenEnabled
  ]
] as const;

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} test(s) passed.`);
