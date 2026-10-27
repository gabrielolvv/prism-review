import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { oneEditApart } from "../../src/rules/lookalike-dependency.js";

export function testLookalikeDependencyRuleReportsTyposquats(): void {
  const findings = lookalikes([
    file("package.json", [
      '  "name": "my-app",',
      '  "version": "1.0.0",',
      '  "scripts": { "test": "jest" },',
      '  "dependencies": {',
      '    "expresss": "^4.18.2",',
      '    "lodahs": "4.17.21",',
      '    "react": "^18.2.0",',
      '    "preact": "^10.19.0",',
      '    "@acme/reactt": "^1.0.0",',
      '    "my-widgets": "^2.0.0"',
      "  },",
      '  "engines": { "node": ">=18" }'
    ]),
    file("requirements.txt", ["reqeusts==2.31.0", "numpy>=1.26", "djang0[argon2] ~= 5.0", "-r base.txt", "git+https://example.com/pkg.git", "# pandsa"]),
    file("pyproject.toml", [
      "[project]",
      'name = "service"',
      'dependencies = ["pandsa>=2.0", "fastapi"]',
      'classifiers = ["License :: OSI Approved :: MIT License"]',
      "[tool.poetry.dependencies]",
      'python = "^3.11"',
      'flsk = "^3.0"'
    ]),
    file("Gemfile", ['gem "railz"', "gem 'devise'"]),
    file("mygem.gemspec", ['  spec.add_dependency "nokogirl", "~> 1.15"']),
    file("Cargo.toml", ["[package]", 'name = "serdee"', 'version = "0.1.0"', "", "[dependencies]", 'serde_jsno = "1"', 'tokio = { version = "1", features = ["full"] }']),
    file("Pipfile", ["[packages]", 'reqests = "*"', "[requires]", 'python_version = "3.11"'])
  ]);

  const byFile = new Map(findings.map((finding) => [finding.file, finding]));
  assert.deepEqual([...byFile.keys()].sort(), ["Cargo.toml", "Gemfile", "Pipfile", "mygem.gemspec", "package.json", "pyproject.toml", "requirements.txt"]);
  assert.equal(
    byFile.get("package.json")?.message,
    "Lines 5, 6 add expresss (like express), lodahs (like lodash): names one character away from a popular npm package, a common way to slip in a malicious one."
  );
  assert.deepEqual(byFile.get("package.json")?.lines, [5, 6]);
  assert.match(byFile.get("requirements.txt")?.message ?? "", /^Lines 1, 3 add reqeusts \(like requests\), djang0 \(like django\):/);
  assert.match(byFile.get("pyproject.toml")?.message ?? "", /^Lines 3, 7 add pandsa \(like pandas\), flsk \(like flask\):/);
  assert.match(byFile.get("Gemfile")?.message ?? "", /^Line 1 adds railz \(like rails\): a name one character away from a popular RubyGems package/);
  assert.match(byFile.get("mygem.gemspec")?.message ?? "", /nokogirl \(like nokogiri\)/);
  assert.match(byFile.get("Cargo.toml")?.message ?? "", /^Line 6 adds serde_jsno \(like serde_json\):/);
  assert.match(byFile.get("Pipfile")?.message ?? "", /^Line 2 adds reqests \(like requests\):/);
  assert.ok(findings.every((finding) => finding.severity === "warning"));
}

export function testLookalikeDependencyRuleSkipsKnownAndUnrelatedNames(): void {
  const config = prismConfigSchema.parse({ rules: { lookalikeDependencies: { allowed: ["Expresss"] } } });
  const files = [
    file("package.json", ['    "expresss": "^4.18.2"']),
    // PyPI ignores case and treats `-`, `_`, and `.` alike, so these are the popular packages.
    file("requirements.txt", ["Python_DateUtil==2.9", "typing.extensions>=4"]),
    // Removed lines, test data, and other files are not read.
    { ...file("Gemfile", []), patch: '@@ -1 +0,0 @@\n-gem "railz"' },
    file("fixtures/package.json", ['    "expresss": "^4.18.2"']),
    file("src/package.ts", ['    "expresss": "^4.18.2"'])
  ];

  assert.deepEqual(findingsFor(files, config), []);
  assert.equal(findingsFor([file("package.json", ['"expresss": "1.0.0"'])], prismConfigSchema.parse({ rules: { lookalikeDependencies: { enabled: false } } })).length, 0);
}

export function testOneEditApart(): void {
  const cases: Array<[string, string, boolean]> = [
    ["express", "expresss", true],
    ["lodash", "lodahs", true],
    ["axios", "axois", true],
    ["django", "djang0", true],
    ["react", "eract", true],
    ["react", "react", false],
    ["react", "reactjs", false],
    ["lodash", "ldaosh", false],
    ["abc", "acb", true],
    ["", "a", true]
  ];
  for (const [left, right, expected] of cases) {
    assert.equal(oneEditApart(left, right), expected, `${left} / ${right}`);
    assert.equal(oneEditApart(right, left), expected, `${right} / ${left}`);
  }
}

function lookalikes(files: ChangedFile[]) {
  return findingsFor(files, defaultConfig);
}

function findingsFor(files: ChangedFile[], config: typeof defaultConfig) {
  return analyzePullRequest(files, config).findings.filter((finding) => finding.ruleId === "lookalike-dependency");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
