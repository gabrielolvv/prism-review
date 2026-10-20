import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";
import { parseUnifiedDiff } from "../../src/testing/parse-unified-diff.js";

// Built at runtime so the repository contains no hidden characters or escape ambiguity.
const backslash = String.fromCharCode(92);
const rlo = String.fromCodePoint(0x202e);
const join = (...parts: string[]) => parts.join("");

export function testParseUnifiedDiffDecodesQuotedPaths(): void {
  // git quotes a path with non-ASCII bytes and spells them as octal escapes.
  const quoted = `"b/docs/inv${backslash}342${backslash}200${backslash}256exe.txt"`;
  const diff = [
    `diff --git "a/docs/inv${backslash}342${backslash}200${backslash}256exe.txt" ${quoted}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ ${quoted}`,
    "@@ -0,0 +1 @@",
    "+hello",
    "diff --git a/src/plain.ts b/src/plain.ts",
    "--- a/src/plain.ts",
    "+++ b/src/plain.ts",
    "@@ -1 +1 @@",
    "-a",
    "+b"
  ].join("\n");

  const files = parseUnifiedDiff(diff);

  assert.deepEqual(
    files.map((file) => [file.path, file.status]),
    [
      [`docs/inv${rlo}exe.txt`, "added"],
      ["src/plain.ts", "modified"]
    ]
  );
}

export function testParseUnifiedDiffHandlesPrefixSettings(): void {
  const mnemonic = parseUnifiedDiff(
    ["diff --git i/src/a.ts w/src/a.ts", "--- i/src/a.ts", "+++ w/src/a.ts", "@@ -1 +1 @@", "-a", "+b"].join("\n")
  );
  const noPrefix = parseUnifiedDiff(
    ["diff --git src/a.ts src/a.ts", "--- src/a.ts", "+++ src/a.ts", "@@ -1 +1 @@", "-a", "+b"].join("\n")
  );
  const binary = parseUnifiedDiff(
    ["diff --git a/logo.png b/logo.png", "new file mode 100644", "Binary files /dev/null and b/logo.png differ"].join("\n")
  );

  assert.deepEqual(mnemonic.map((file) => file.path), ["src/a.ts"]);
  assert.deepEqual(noPrefix.map((file) => file.path), ["src/a.ts"]);
  assert.deepEqual(binary.map((file) => [file.path, file.status]), [["logo.png", "added"]]);
}

export function testParseUnifiedDiffRejectsUnrecognizedHeaders(): void {
  assert.throws(
    () => parseUnifiedDiff(["diff --git weird-header-with-no-paths", "@@ -1 +1 @@", "+x"].join("\n")),
    /Unrecognized diff header: diff --git weird-header-with-no-paths/
  );
}

export function testHiddenUnicodeRuleScansOversizedPatches(): void {
  const config = prismConfigSchema.parse({ security: { maxPatchBytes: 1000 } });
  const patch = ["@@ -0,0 +1,2 @@", `+${"a".repeat(2000)}`, `+/*${rlo} } */ return true;`].join("\n");
  const files = prepareChangedFiles(
    [{ path: "src/generated.ts", status: "added", additions: 2, deletions: 0, patch }],
    config
  );

  const finding = analyzePullRequest(files, config).findings.find((candidate) => candidate.ruleId === "hidden-unicode");

  assert.equal(files[0]?.patch, undefined);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.line, 2);
}

export function testHiddenUnicodeRuleReportsInvisibleIdentifiers(): void {
  const hangulFiller = String.fromCodePoint(0x3164);
  const invisibleTimes = String.fromCodePoint(0x2062);
  const findings = ruleFindings("hidden-unicode", [
    file("src/routes/admin.js", [`const { timeout, ${hangulFiller} } = req.query;`, `const total = price${invisibleTimes}qty;`])
  ]);

  assert.equal(findings[0]?.severity, "warning");
  assert.match(findings[0]?.message ?? "", /U\+3164 HANGUL FILLER, U\+2062 INVISIBLE TIMES/);
}

export function testBlanketSuppressionRuleReportsPhpcsIgnoreFile(): void {
  const findings = ruleFindings("blanket-suppression", [file("src/Legacy.php", [`// ${join("phpcs", ":ignoreFile")}`])]);

  assert.equal(findings[0]?.line, 1);
}

export function testRiskyApiRuleReadsRubyEvalAndShellForms(): void {
  const evalForm = join("class", "_eval");
  const flagged = ruleFindings("risky-api", [
    file("app/models/concerns/dynamic.rb", [
      `    ${evalForm} <<-RUBY, __FILE__, __LINE__ + 1`,
      `${join("Ker", "nel")}.${join("sys", "tem")}("tar xzf #{archive}")`,
      `${join("Pro", "cess")}.${join("sp", "awn")}("ls #{dir}")`
    ])
  ]);
  const ignored = ruleFindings("risky-api", [
    file("app/models/concerns/scoped.rb", [
      `    ${evalForm} do`,
      `    ${evalForm} { attr_accessor :name }`,
      `    instance_${join("ev", "al")}(&block)`,
      `puts "Run ${join("`", "rake db:migrate", "`")} for #{env}"`
    ])
  ]);

  assert.equal(flagged.length, 1);
  assert.match(flagged[0]?.message ?? "", /^Lines 1, 2, 3 add/);
  assert.deepEqual(ignored, []);
}

export function testSkippedTestsRuleTellsPestFromLaravel(): void {
  const skip = join("->", "skip");
  const flagged = ruleFindings("skipped-tests", [
    file("tests/Feature/CheckoutTest.php", [
      `it('charges cards', function () { /* ... */ })${skip}('flaky');`,
      `test('refunds')${skip}();`,
      `    ${skip}('needs redis');`
    ])
  ]);
  const ignored = ruleFindings("skipped-tests", [
    file("tests/Feature/UserListTest.php", [
      `$users = User::query()${skip}(10)->take(5)->get();`,
      `    ${skip}($offset)`,
      `$page = collect($items)${skip}(20);`
    ])
  ]);

  assert.deepEqual(flagged.map((finding) => finding.line), [1]);
  assert.match(flagged[0]?.message ?? "", /^Lines 1, 2, 3 skip tests/);
  assert.deepEqual(ignored, []);
}

export function testSkippedTestsRuleReadsCombinedCSharpAttributes(): void {
  const ignore = join("Ign", "ore");
  const flagged = ruleFindings("skipped-tests", [
    file("tests/Api.Tests/OrderTests.cs", [`    [Test, ${ignore}("flaky")]`, `    [TestMethod, ${ignore}]`])
  ]);
  const ignored = ruleFindings("skipped-tests", [
    file("tests/Api.Tests/DtoTests.cs", ["    [JsonIgnore]", "    [IgnoreDataMember]"])
  ]);

  assert.match(flagged[0]?.message ?? "", /^Lines 1, 2 skip tests/);
  assert.deepEqual(ignored, []);
}

function ruleFindings(ruleId: string, files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === ruleId);
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
