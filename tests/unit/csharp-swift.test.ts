import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig } from "../../src/config/schema.js";

// Markers are assembled at runtime so this file is not flagged by the rules it tests.
const join = (...parts: string[]) => parts.join("");

export function testLineRulesCoverCSharp(): void {
  const risky = ruleFindings("risky-api", [
    file("src/Api/Deploy.cs", [
      `Process.Start("${join("cm", "d")}", "/c " + script);`,
      `var info = new ProcessStartInfo { FileName = "/bin/${join("ba", "sh")}", Arguments = $"-c {cmd}" };`,
      `var formatter = new ${join("Binary", "Formatter")}();`,
      `@Html.${join("R", "aw")}(Model.Body)`
    ])
  ]);
  const blanket = ruleFindings("blanket-suppression", [
    file("src/Api/Legacy.cs", [`#pragma warning ${join("dis", "able")}`, `// ${join("Re", "Sharper")} disable All`])
  ]);
  const skipped = ruleFindings("skipped-tests", [
    file("tests/Api.Tests/OrderTests.cs", [
      `    [Fact(${join("Sk", "ip")} = "flaky")]`,
      `    [${join("Ign", "ore")}("needs db")]`
    ])
  ]);

  assert.deepEqual(lines(risky), [["src/Api/Deploy.cs", 1]]);
  assert.match(risky[0]?.message ?? "", /^Lines 1, 2, 3, 4 add/);
  assert.deepEqual(lines(blanket), [["src/Api/Legacy.cs", 1]]);
  assert.match(blanket[0]?.message ?? "", /^Lines 1, 2 turn off/);
  assert.deepEqual(lines(skipped), [["tests/Api.Tests/OrderTests.cs", 1]]);
  assert.match(skipped[0]?.message ?? "", /^Lines 1, 2 skip tests/);
}

export function testLineRulesCoverSwift(): void {
  const risky = ruleFindings("risky-api", [
    file("Sources/App/Shell.swift", [
      `process.executableURL = URL(fileURLWithPath: "/bin/${join("z", "sh")}")`,
      `let object = ${join("NSKeyed", "Unarchiver")}.unarchiveObject(with: data)`,
      `webView.${join("evaluate", "JavaScript")}("render(\\(payload))")`
    ])
  ]);
  const blanket = ruleFindings("blanket-suppression", [
    file("Sources/App/Legacy.swift", [`// ${join("swift", "lint")}:disable all`])
  ]);
  const skipped = ruleFindings("skipped-tests", [
    file("Tests/AppTests/LoginTests.swift", [
      `        throw ${join("XCT", "Skip")}("needs keychain")`,
      `    @Test(.${join("dis", "abled")}("flaky")) func refreshes() {}`
    ])
  ]);

  assert.deepEqual(lines(risky), [["Sources/App/Shell.swift", 1]]);
  assert.match(risky[0]?.message ?? "", /^Lines 1, 2, 3 add/);
  assert.deepEqual(lines(blanket), [["Sources/App/Legacy.swift", 1]]);
  assert.deepEqual(lines(skipped), [["Tests/AppTests/LoginTests.swift", 1]]);
}

export function testLineRulesIgnoreCSharpAndSwiftLookalikes(): void {
  const findings = analyzePullRequest(
    [
      file("src/Api/Git.cs", [
        `Process.Start("git", "status");`,
        `#pragma warning ${join("dis", "able")} CS0618 // obsolete API until v3`,
        "var json = JsonSerializer.Deserialize<Order>(body);",
        "@Html.Encode(Model.Body)",
        `var ${join("sk", "ip")} = true;`
      ]),
      file("Sources/App/Git.swift", [
        "process.executableURL = URL(fileURLWithPath: \"/usr/bin/git\")",
        `// ${join("swift", "lint")}:disable force_cast`,
        "let decoded = try JSONDecoder().decode(Order.self, from: data)",
        "webView.evaluateJavaScript(\"document.title\")"
      ]),
      file("Tests/AppTests/GitTests.swift", ["    @Test func clones() {}"])
    ],
    defaultConfig
  ).findings.filter((finding) =>
    ["risky-api", "blanket-suppression", "skipped-tests"].includes(finding.ruleId)
  );

  assert.deepEqual(findings, []);
}

function ruleFindings(ruleId: string, files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === ruleId);
}

function lines(findings: Array<{ file?: string; line?: number }>) {
  return findings.map((finding) => [finding.file, finding.line]);
}

function file(path: string, contents: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${contents.length} @@`, ...contents.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: contents.length, deletions: 0, patch };
}
