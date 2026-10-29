import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { ambiguousGroup } from "../../src/analysis/regex-ambiguity.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { redosRule } from "../../src/rules/redos.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return redosRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testAmbiguousGroupFindsNestedRepetition(): void {
  const ambiguous: Array<[string, string]> = [
    [String.raw`^(\w+\s?)*$`, String.raw`(\w+\s?)*`],
    [String.raw`^([a-z]+\.?)+$`, String.raw`([a-z]+\.?)+`],
    [String.raw`(\s*\w+)+@`, String.raw`(\s*\w+)+`],
    ["(.*)*x", "(.*)*"],
    ["(?:a+){2,}b", "(?:a+){2,}"],
    [String.raw`(?<word>\d+)+$`, String.raw`(?<word>\d+)+`],
    [String.raw`^([^/]+/?)*$`, String.raw`([^/]+/?)*`],
    // brace-expansion's CVE-2017-18077: `.*` can also match the comma that ends each repetition.
    ["^(.*,)+(.+)?$", "(.*,)+"],
    // Nested inside another group.
    [String.raw`^(?:id=((\d+)+))$`, String.raw`(\d+)+`]
  ];
  for (const [pattern, group] of ambiguous) {
    assert.equal(ambiguousGroup(pattern), group, pattern);
  }

  const safe = [
    String.raw`^(\d+,)*\d+$`, // a required separator ends each repetition
    "(a+b+)+",
    "(a|aa)+", // alternations are not compared
    String.raw`(?>\w+\s?)*`, // atomic group
    String.raw`(\w+\s?)*+`, // possessive quantifier
    String.raw`(\w++\s?)*`,
    String.raw`[(a+)+]`, // a character class
    String.raw`\(a+\)+`, // escaped parentheses
    "(x?)*",
    String.raw`(\d{1,3}\.){3}\d{1,3}`, // bounded
    "(?:[a-z]+)?",
    "(foo)+",
    // One required part that the repeated part cannot match starts each repetition.
    "([01]_*)+",
    String.raw`(?:\n(?!-)[^\n]*)*`,
    String.raw`( *[-*_]){3,}`,
    String.raw`(?:\s*\[)+`,
    String.raw`(((\/\/.*$)|(\/\*[^*]*\*\/))\s*)*`,
    "((("
  ];
  for (const pattern of safe) {
    assert.equal(ambiguousGroup(pattern), undefined, pattern);
  }
}

export function testRedosReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/validate.ts", [
      String.raw`export const email = /^([a-zA-Z0-9]+\.?)+@example\.com$/;`,
      String.raw`export const words = new RegExp("^(\\w+\\s?)*$");`,
      String.raw`export const csv = /^(\d+,)*\d+$/;`
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Regular expression open to ReDoS");
  assert.deepEqual(finding?.lines, [1, 2]);
  assert.equal(
    finding?.message,
    String.raw`Lines 1, 2 add regular expressions with a repeated group that can match the same text in many ways, such as ([a-zA-Z0-9]+\.?)+, which can take exponential time on a crafted input (ReDoS).`
  );
}

export function testRedosReadsEachLanguage(): void {
  const cases: Array<[string, string]> = [
    ["app/validators.py", String.raw`EMAIL = re.compile(r"^([a-z0-9]+\.?)+@")`],
    ["app/validators.py", String.raw`if re.match("^(\\w+\\s?)*$", value):`],
    ["app/models/user.rb", String.raw`validates :name, format: { with: /\A(\w+\s?)*\z/ }`],
    ["app/models/user.rb", String.raw`NAME = Regexp.new('\A(\w+\s?)*\z')`],
    ["src/main/java/Validator.java", String.raw`private static final Pattern NAME = Pattern.compile("^(\\w+\\s?)*$");`],
    ["src/main/kotlin/Validator.kt", String.raw`val name = Regex("^(\\w+\\s?)*$")`],
    ["Validators/Name.cs", String.raw`var name = new Regex(@"^(\w+\s?)*$");`],
    ["Validators/Name.cs", String.raw`if (Regex.IsMatch(input, "^(\\w+\\s?)*$")) {`],
    ["src/Validator.php", String.raw`if (preg_match('/^(\w+\s?)*$/i', $name)) {`]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testRedosSkipsOtherCode(): void {
  const safe: Array<[string, string]> = [
    // Go and Rust match in linear time.
    ["internal/validate.go", "var name = regexp.MustCompile(`^(\\w+\\s?)*$`)"],
    ["src/validate.rs", String.raw`let name = Regex::new(r"^(\w+\s?)*$").unwrap();`],
    // A division is not a regular expression.
    ["src/math.ts", "const ratio = (total + 1) / (count * 2) / scale;"],
    // Comments, and a quoted pattern that is not passed to a regex call.
    ["src/validate.ts", String.raw`// const words = /^(\w+\s?)*$/;`],
    ["app/validators.py", String.raw`HELP = "Use ^(\\w+\\s?)*$ in the field"`]
  ];
  for (const [path, line] of safe) {
    assert.deepEqual(findings([added(path, [line])]), [], `${path}: ${line}`);
  }

  const line = String.raw`const words = /^(\w+\s?)*$/;`;
  assert.deepEqual(findings([added("src/words.test.ts", [line]), added("docs/regex.md", [line]), added("vendor/lib.min.js", [line])]), []);
}

export function testRedosCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { redos: { enabled: false } } });

  assert.deepEqual(findings([added("src/words.ts", [String.raw`const words = /^(\w+\s?)*$/;`])], config), []);
}
