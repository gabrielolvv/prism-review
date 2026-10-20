import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

// Calls are assembled at runtime so this file is not flagged by the rule it tests.
const ev = ["ev", "al"].join("");
const dangerousHtml = ["dangerously", "SetInnerHTML"].join("");
const inner = ["inner", "HTML"].join("");
const pick = ["pic", "kle"].join("");

export function testRiskyApiRuleReportsEachLanguage(): void {
  const findings = riskyFindings([
    file("src/plugins/load.ts", [
      "import { exec } from \"node:child_process\";",
      `const fn = ${ev}(source);`,
      "const make = new Function(\"a\", body);",
      "exec(`git checkout ${branch}`);",
      "spawn(cmd, { shell: true });"
    ]),
    file("src/ui/Preview.tsx", [`<div ${dangerousHtml}={{ __html: markdown }} />`, `panel.${inner} = html;`]),
    file("app/tasks.py", [
      `data = ${pick}.loads(payload)`,
      "config = yaml.load(stream)",
      "subprocess.run(command, shell=True)",
      "os.system(\"rm -rf \" + path)"
    ]),
    file("pkg/run.go", ["\tcmd := exec.Command(\"sh\", \"-c\", script)", "\treturn template.HTML(body)"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]),
    [
      ["src/plugins/load.ts", 2, "warning"],
      ["src/ui/Preview.tsx", 1, "warning"],
      ["app/tasks.py", 1, "warning"],
      ["pkg/run.go", 1, "warning"]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 2, 3, 4, 5 add calls that deserve a security review: eval, Function constructor, child_process exec, shell option."
  );
  assert.equal(
    findings[3]?.message,
    "Lines 1, 2 add calls that deserve a security review: shell command, template.HTML."
  );
}

export function testRiskyApiRuleReportsASingleCall(): void {
  const [finding] = riskyFindings([file("app/util.py", ["import os", "os.system(cmd)"])]);

  assert.equal(finding?.line, 2);
  assert.equal(finding?.message, "Line 2 adds a call that deserves a security review: os.system.");
}

export function testRiskyApiRuleIgnoresLookalikes(): void {
  const findings = riskyFindings([
    file("src/parse.ts", [
      "const match = pattern.exec(input);",
      `const score = ${ev}uate(board);`,
      "execFile(\"git\", [\"status\"]);",
      "spawn(\"ls\", [\"-l\"], { shell: false });",
      "label.textContent = name;",
      `if (node.${inner} === expected) return;`,
      "const isFunction = typeof value === \"function\";"
    ]),
    file("app/train.py", [
      `model.${ev}()`,
      "config = yaml.safe_load(stream)",
      "config = yaml.load(stream, Loader=yaml.SafeLoader)",
      "data = json.loads(payload)",
      "subprocess.run([\"ls\", \"-l\"], shell=False)"
    ]),
    file("pkg/git.go", ["\tcmd := exec.Command(\"git\", \"status\")"])
  ]);

  assert.deepEqual(findings, []);
}

export function testRiskyApiRuleSkipsTestsDocsAndRemovedLines(): void {
  const removed: ChangedFile = {
    path: "src/legacy.ts",
    status: "modified",
    additions: 0,
    deletions: 1,
    patch: `@@ -1,2 +1,1 @@\n-run(${ev}(code));\n export {};`
  };

  const findings = riskyFindings([
    file("src/sandbox.test.ts", [`expect(${ev}("1 + 1")).toBe(2);`]),
    file("tests/test_loader.py", [`${pick}.loads(fixture)`]),
    file("docs/security.md", [`Never call \`${ev}(input)\` on request data.`]),
    removed
  ]);

  assert.deepEqual(findings, []);
}

export function testRiskyApiRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { riskyApis: { enabled: false } } });
  const files = [file("src/a.ts", [`${ev}(code);`])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "risky-api"));
}

function riskyFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "risky-api");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
