import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

// Markers are assembled at runtime so this file is not flagged by the rule it tests.
const eslint = ["eslint", "disable"].join("-");
const noqa = ["no", "qa"].join("");
const nolint = ["no", "lint"].join("");
const allRustWarn = ["warn", "ings"].join("");

export function testBlanketSuppressionRuleReportsEachLanguage(): void {
  const files = [
    file("src/legacy.ts", [`/* ${eslint} */`, "// @ts-" + "nocheck", "export const x = 1;"]),
    file("src/widget.tsx", ["const a = 1;", `// ${eslint}-next-line`, "use(a);"]),
    file("app/models.py", [`run(os.environ)  # ${noqa}`, `value = load()  # type: ${"ignore"}`]),
    file("app/settings.py", [`# pylint: disable=${"all"}`, `# mypy: ${"ignore-errors"}`]),
    file("pkg/client.go", [`func Dial() error { //${nolint}`, "\treturn nil", "}"]),
    file("src/lib.rs", [`#![allow(${allRustWarn})]`, `#[allow(clippy::${"all"})]`])
  ];

  const findings = blanketFindings(files);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]),
    [
      ["src/legacy.ts", 1, "warning"],
      ["src/widget.tsx", 2, "warning"],
      ["app/models.py", 1, "warning"],
      ["app/settings.py", 1, "warning"],
      ["pkg/client.go", 1, "warning"],
      ["src/lib.rs", 1, "warning"]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 1, 2 turn off lint or type checks without naming which ones (ESLint, TypeScript), so new problems in their scope go unreported."
  );
  assert.equal(
    findings[1]?.message,
    "Line 2 turns off lint or type checks without naming which ones (ESLint), so new problems in its scope go unreported."
  );
}

export function testBlanketSuppressionRuleIgnoresTargetedSuppressions(): void {
  const files = [
    file("src/a.ts", [
      `// ${eslint}-next-line no-console`,
      `/* ${eslint} no-var, prefer-const */`,
      `// ${eslint}-line @typescript-eslint/no-explicit-any -- legacy API`,
      "// @ts-expect-error upstream types are wrong",
      `const ${eslint}Rules = [];`,
      "const directive = /@ts-" + "nocheck/;"
    ]),
    file("app/b.py", [`x = 1  # ${noqa}: E501`, `y = f()  # type: ${"ignore"}[arg-type]`, `# pylint: disable=line-too-long`]),
    file("pkg/c.go", [`func F() { //${nolint}:errcheck // closed by caller`]),
    file("src/d.rs", ["#[allow(dead_code)]", "#[allow(clippy::too_many_arguments)]"]),
    file("docs/linting.md", [`Avoid \`/* ${eslint} */\` at the top of a file.`])
  ];

  assert.deepEqual(blanketFindings(files), []);
}

export function testBlanketSuppressionRuleSkipsPythonMarkersWithOneUse(): void {
  const typeIgnore = `# type: ${"ignore"}`;
  const skipped = file("app/__init__.py", [
    // Re-exports, imports below code, and modules without type stubs.
    `from .models import *  # ${noqa}`,
    `import yaml  ${typeIgnore}`,
    // A long URL in a comment, and the line that closes a long string.
    `# See https://example.com/a/very/long/path#section  # ${noqa}`,
    'EXPECTED = """',
    "<td>a long row of expected output</td>",
    `"""  # ${noqa}`
  ]);
  assert.deepEqual(blanketFindings([skipped]), []);

  // Whole-file markers, and markers on code, are still reported.
  const reported = blanketFindings([
    file("app/views.py", [
      `# flake8: ${noqa}`,
      typeIgnore,
      `QUERY = """  # ${noqa}`,
      "select 1",
      '"""',
      `render(User)  # ${noqa}`
    ])
  ]);
  assert.deepEqual(reported[0]?.lines, [1, 2, 3, 6]);
}

export function testBlanketSuppressionRuleIgnoresRemovedLines(): void {
  const patch = `@@ -1,2 +1,1 @@\n-/* ${eslint} */\n export {};`;

  assert.deepEqual(
    blanketFindings([{ path: "src/a.ts", status: "modified", additions: 0, deletions: 1, patch }]),
    []
  );
}

export function testBlanketSuppressionRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { blanketSuppression: { enabled: false } } });
  const files = [file("src/a.ts", [`/* ${eslint} */`])];

  assert.ok(
    !analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "blanket-suppression")
  );
}

export function testBlanketSuppressionRuleChecksMarkersInTheirLanguage(): void {
  const findings = blanketFindings([
    file("src/links.ts", [
      `const docs = "http://example.com#${noqa}";`,
      `const hint = "# type: ${"ignore"}";`,
      `const go = "//${nolint}";`
    ]),
    file("src/call.ts", ["// @ts-" + "ignore", "legacyCall(value);"]),
    file("app/views.py", [`render(page)  # ${noqa}`])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      ["src/call.ts", 1],
      ["app/views.py", 1]
    ]
  );
  assert.match(findings[0]?.message ?? "", /\(TypeScript\)/);
}

function blanketFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter(
    (finding) => finding.ruleId === "blanket-suppression"
  );
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
