import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig } from "../../src/config/schema.js";

// Markers are assembled at runtime so this file is not flagged by the rules it tests.
const join = (...parts: string[]) => parts.join("");

export function testRiskyApiRuleCoversRubyJavaAndPhp(): void {
  const findings = ruleFindings("risky-api", [
    file("app/services/runner.rb", [
      `${join("ev", "al")}(params[:code])`,
      `${join("sys", "tem")}("tar xzf #{archive}")`,
      `output = ${join("%", "x(")}git log #{ref})`,
      `data = ${join("Mar", "shal")}.load(cookie)`,
      `config = YAML.${join("unsafe", "_load")}(body)`,
      `label.${join("html", "_safe")}`
    ]),
    file("src/main/java/com/acme/Deploy.java", [
      `Runtime.getRuntime().${join("ex", "ec")}(command);`,
      `new ProcessBuilder("${join("ba", "sh")}", "-c", script).start();`,
      `var in = new ${join("ObjectInput", "Stream")}(socket.getInputStream());`
    ]),
    file("public/admin.php", [
      `${join("ev", "al")}($_POST['code']);`,
      `$out = ${join("shell", "_exec")}("ping " . $host);`,
      `$user = ${join("unseri", "alize")}($_COOKIE['user']);`
    ])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      ["app/services/runner.rb", 1],
      ["src/main/java/com/acme/Deploy.java", 1],
      ["public/admin.php", 1]
    ]
  );
  assert.match(findings[0]?.message ?? "", /^Lines 1, 2, 3, 4, 5 and 1 more add/);
  assert.match(findings[1]?.message ?? "", /^Lines 1, 2, 3 add/);
  assert.match(findings[2]?.message ?? "", /^Lines 1, 2, 3 add/);
}

export function testRiskyApiRuleIgnoresRubyJavaAndPhpLookalikes(): void {
  const findings = ruleFindings("risky-api", [
    file("app/models/report.rb", [
      `def ${join("ev", "al")}(expression)`,
      `result = calculator.${join("ev", "al")}(expression)`,
      "config = YAML.safe_load(body)",
      `${join("sys", "tem")}_name = "linux"`
    ]),
    file("src/main/java/com/acme/Git.java", [
      "new ProcessBuilder(\"git\", \"status\").start();",
      "Runtime.getRuntime().availableProcessors();"
    ]),
    file("src/Shell.php", [
      `public function ${join("ex", "ec")}(string $command): void {`,
      `$runner->${join("ex", "ec")}($command);`,
      `$data = json_decode($payload, true);`
    ])
  ]);

  assert.deepEqual(findings, []);
}

export function testBlanketSuppressionRuleCoversRubyJavaAndPhp(): void {
  const findings = ruleFindings("blanket-suppression", [
    file("lib/legacy.rb", [`# ${join("rubo", "cop")}:disable all`, "def run; end"]),
    file("src/main/java/com/acme/Legacy.java", [
      `@${join("Suppress", "Warnings")}("all")`,
      `// ${join("CHECK", "STYLE")}:OFF`,
      `int x = load(); // ${join("NO", "SONAR")}`
    ]),
    file("src/Legacy.php", [
      `$x = risky(); // @${join("phpstan", "-ignore-line")}`,
      `// ${join("php", "cs")}:ignore`,
      `/** @${join("psalm", "-suppress")} all */`
    ])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      ["lib/legacy.rb", 1],
      ["src/main/java/com/acme/Legacy.java", 1],
      ["src/Legacy.php", 1]
    ]
  );
  assert.match(findings[1]?.message ?? "", /^Lines 1, 2, 3 turn off/);
}

export function testBlanketSuppressionRuleIgnoresTargetedRubyJavaAndPhp(): void {
  const findings = ruleFindings("blanket-suppression", [
    file("lib/a.rb", [`# ${join("rubo", "cop")}:disable Metrics/MethodLength`]),
    file("src/main/java/A.java", [`@${join("Suppress", "Warnings")}("unchecked")`]),
    file("src/A.php", [
      `// @${join("phpstan", "-ignore")} argument.type`,
      `// ${join("php", "cs")}:ignore Generic.Files.LineLength`
    ])
  ]);

  assert.deepEqual(findings, []);
}

export function testSkippedTestsRuleCoversRubyJavaAndPhp(): void {
  const findings = ruleFindings("skipped-tests", [
    file("spec/models/user_spec.rb", [
      `  ${join("f", "it")} "validates email" do`,
      `  ${join("x", "it")} "sends welcome mail" do`,
      `  it "charges", ${join("fo", "cus")}: true do`
    ]),
    file("test/models/order_test.rb", [`    ${join("sk", "ip")} "flaky on CI"`, `    ${join("sk", "ip")}("needs network")`]),
    file("src/test/java/com/acme/OrderTest.java", [`  @${join("Dis", "abled")}("slow")`, "  @Test void ships() {}"]),
    file("tests/Unit/CartTest.php", [`        $this->${join("markTest", "Skipped")}('needs redis');`])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.title]),
    [
      ["spec/models/user_spec.rb", 1, "Focused test added"],
      ["test/models/order_test.rb", 1, "Skipped test added"],
      ["src/test/java/com/acme/OrderTest.java", 1, "Skipped test added"],
      ["tests/Unit/CartTest.php", 1, "Skipped test added"]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 1, 3 focus tests, so the runner skips the other tests in scope. Line 2 skips a test, so it can stop running without failing."
  );
}

export function testSkippedTestsRuleKeepsMarkersInTheirLanguage(): void {
  // An RSpec-style line in a Jest file, and a Jest-style call in an RSpec file, are not markers.
  const findings = ruleFindings("skipped-tests", [
    file("src/cart.test.ts", [`const ${join("sk", "ip")} = true;`, `  ${join("pen", "ding")}: 3,`]),
    file("spec/cart_spec.rb", [
      `  expect(cart.${join("sk", "ip")}(2)).to eq(items)`,
      `  ${join("f", "it")} = layout.scale(width)`,
      `  ${join("sk", "ip")} = ENV.fetch("SKIP", "0")`
    ])
  ]);

  assert.deepEqual(findings, []);
}

function ruleFindings(ruleId: string, files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === ruleId);
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
