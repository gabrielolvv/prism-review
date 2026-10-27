import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

// Markers are assembled at runtime so this test file is not flagged by the rule it tests.
const only = (name: string) => `${name}.${"only"}`;
const skip = (name: string) => `${name}.${"skip"}`;

export function testSkippedTestsRuleReportsFocusAndSkipWithLines(): void {
  const patch = [
    "@@ -1,3 +1,6 @@",
    ' import { login } from "./login";',
    `+${only("describe")}("login", () => {`,
    `+  ${skip("it")}("rejects expired sessions", () => {});`,
    "   it(\"accepts valid sessions\", () => {});",
    `+  ${skip("test")}.each\`a | b\`("table", () => {});`,
    "+});"
  ].join("\n");

  const finding = skippedTestsFindings([testFile("src/auth/login.test.ts", patch)])[0];

  assert.deepEqual(finding, {
    ruleId: "skipped-tests",
    title: "Focused test added",
    severity: "warning",
    file: "src/auth/login.test.ts",
    line: 2,
    lines: [2, 3, 5],
    message:
      "Line 2 focuses a test, so the runner skips the other tests in scope. Lines 3, 5 skip tests, so they can stop running without failing.",
    recommendation:
      "Remove focus markers before merging. If a test is skipped on purpose, explain why and link the issue that tracks re-enabling it."
  });
}

export function testSkippedTestsRuleIgnoresRemovedLinesAndNonTestFiles(): void {
  const removal = `@@ -1,2 +1,2 @@\n-${only("it")}("works", () => {});\n+it("works", () => {});`;
  const source = `@@ -0,0 +1 @@\n+export const first = ${only("test")}(items);`;

  assert.deepEqual(
    skippedTestsFindings([testFile("src/a.test.ts", removal), testFile("src/test-utils.ts", source)]),
    []
  );
}

export function testSkippedTestsRuleIgnoresLookalikes(): void {
  const patch = [
    "@@ -0,0 +1,7 @@",
    "+const parts = name.split.only(1);",
    "+describeOnly(\"x\");",
    "+it(\"skips invalid rows\", () => skipRows(rows));",
    "+expect(result.skipped).toBe(2);",
    "+fitAddon.fit();",
    "+const bounds = chart.fit(points);",
    "+runner.xit(\"not a jasmine global\");"
  ].join("\n");

  assert.deepEqual(skippedTestsFindings([testFile("src/rows.spec.ts", patch)]), []);
}

export function testSkippedTestsRuleCoversOtherLanguagesByDefault(): void {
  const files = [
    testFile("app/test_billing.py", `@@ -0,0 +1,2 @@\n+@pytest.mark.${"skip"}(reason="flaky")\n+def test_refund(): ...`),
    testFile("app/tests/test_tax.py", `@@ -0,0 +1 @@\n+@unittest.${"skipIf"}(True, "broken")`),
    testFile("app/model_test.py", `@@ -0,0 +1 @@\n+@pytest.mark.${"skipif"}(sys.platform == "win32", reason="posix only")`),
    testFile("pkg/charge_test.go", `@@ -10,1 +10,2 @@\n func TestCharge(t *testing.T) {\n+\tt.${"Skip"}("gateway down")`),
    testFile("pkg/bench_test.go", `@@ -0,0 +1 @@\n+\ts.T().${"SkipNow"}()`),
    testFile("tests/refund.rs", `@@ -0,0 +1,2 @@\n+#[${"ignore"}]\n+fn refunds_twice() {}`),
    testFile("src/lib.rs", `@@ -40,2 +40,3 @@\n     #[test]\n+    #[${"ignore"} = "slow"]\n     fn parses_large_input() {}`),
    testFile("src/fit.py", `@@ -0,0 +1 @@\n+@pytest.mark.${"skip"}`)
  ];

  const findings = analyzePullRequest(files, defaultConfig).findings.filter(
    (finding) => finding.ruleId === "skipped-tests"
  );

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      ["app/test_billing.py", 1],
      ["app/tests/test_tax.py", 1],
      ["app/model_test.py", 1],
      ["pkg/charge_test.go", 11],
      ["pkg/bench_test.go", 1],
      ["tests/refund.rs", 1],
      ["src/lib.rs", 41]
    ]
  );
}

export function testSkippedTestsRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { skippedTests: { enabled: false } } });
  const files = [testFile("src/a.test.ts", `@@ -0,0 +1 @@\n+${only("it")}("works", () => {});`)];

  assert.ok(
    !analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "skipped-tests")
  );
}

function skippedTestsFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter(
    (finding) => finding.ruleId === "skipped-tests"
  );
}

function testFile(path: string, patch: string): ChangedFile {
  return { path, status: "modified", additions: 1, deletions: 0, patch };
}
