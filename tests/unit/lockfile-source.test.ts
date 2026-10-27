import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

export function testLockfileSourceRuleReportsEachEcosystem(): void {
  const findings = sourceFindings([
    file("package-lock.json", [
      '    "node_modules/left-pad": {',
      '      "version": "1.3.0",',
      '      "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",',
      '    "node_modules/event-stream": {',
      '      "resolved": "https://registry.npmjs.org.evil.example/event-stream/-/event-stream-3.3.6.tgz",',
      '      "resolved": "http://registry.npmjs.org/flatmap-stream/-/flatmap-stream-0.1.1.tgz",',
      '      "resolved": "git+ssh://git@github.com/acme/ui.git#0123abc",'
    ]),
    file("web/yarn.lock", [
      '"lodash@^4.17.21":',
      '  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz#679591c564"',
      '"colors@1.4.1":',
      '  resolved "https://cdn.evil.example/colors-1.4.1.tgz#abc"'
    ]),
    file("pnpm-lock.yaml", [
      "  /ui@1.0.0:",
      "    resolution: {tarball: https://codeload.github.com/acme/ui/tar.gz/0123abc}"
    ]),
    file("requirements.txt", [
      "requests==2.32.3",
      "--extra-index-url https://pypi.internal.example/simple",
      "toolkit @ https://downloads.evil.example/toolkit-1.0-py3-none-any.whl"
    ]),
    file("Cargo.lock", [
      "[[package]]",
      'name = "serde"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
      "[[package]]",
      'name = "patched"',
      'source = "git+https://github.com/acme/patched?rev=0123abc#0123abc"'
    ]),
    file(".npmrc", ["registry=https://npm.evil.example/"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]).sort(),
    [
      [".npmrc", 1, "high"],
      ["Cargo.lock", 6, "warning"],
      ["package-lock.json", 5, "high"],
      ["pnpm-lock.yaml", 2, "warning"],
      ["requirements.txt", 2, "high"],
      ["web/yarn.lock", 4, "high"]
    ].sort()
  );
  const message = (path: string) => findings.find((finding) => finding.file === path)?.message;
  assert.equal(
    message("package-lock.json"),
    "Lines 5, 6, 7 add dependencies downloaded from a host that is not an allowed registry (registry.npmjs.org.evil.example), downloaded over plain HTTP, and installed from a Git repository."
  );
  assert.equal(
    message("requirements.txt"),
    "Lines 2, 3 add dependencies downloaded from a host that is not an allowed registry (downloads.evil.example), and fetched from an extra package index."
  );
  assert.equal(message("Cargo.lock"), "Line 6 adds a dependency installed from a Git repository.");
}

export function testLockfileSourceRuleReadsEverySupportedFile(): void {
  const findings = sourceFindings([
    file("apps/web/package-lock.json", ['      "resolved": "https://evil.example/a.tgz",']),
    file("npm-shrinkwrap.json", ['      "resolved": "https://evil.example/a.tgz",']),
    file(".yarn/yarn.lock", ['  resolution: "pkg@https://evil.example/pkg.tgz"']),
    file("requirements-dev.txt", ["-i https://evil.example/simple"]),
    file("requirements/base.in", ["--index-url https://evil.example/simple"]),
    file("poetry.lock", ["[package.source]", 'type = "legacy"', 'url = "https://evil.example/simple"']),
    file("Pipfile.lock", ['            "url": "https://evil.example/simple",']),
    file("Gemfile.lock", ["GEM", "  remote: https://evil.example/", "  specs:"]),
    file(".yarnrc.yml", ['npmRegistryServer: "https://evil.example"']),
    file("pip.conf", ["[global]", "index-url = https://evil.example/simple"])
  ]);

  assert.deepEqual(
    findings.map((finding) => finding.file).sort(),
    [
      ".yarn/yarn.lock",
      ".yarnrc.yml",
      "Gemfile.lock",
      "Pipfile.lock",
      "apps/web/package-lock.json",
      "npm-shrinkwrap.json",
      "pip.conf",
      "poetry.lock",
      "requirements-dev.txt",
      "requirements/base.in"
    ]
  );
  assert.ok(findings.every((finding) => finding.severity === "high"));
}

export function testLockfileSourceRuleAllowsRegistriesAndLocalPackages(): void {
  const findings = sourceFindings([
    file("package-lock.json", [
      '      "resolved": "https://registry.npmjs.org/@acme/ui/-/ui-1.0.0.tgz",',
      '      "resolved": "file:packages/shared",',
      '      "link": true,',
      '    "node_modules/@acme/shared": {'
    ]),
    file("yarn.lock", ['  resolution: "lodash@npm:4.17.21"', '  resolution: "shared@workspace:packages/shared"']),
    file("pnpm-lock.yaml", ["    resolution: {integrity: sha512-abc}"]),
    file("requirements.txt", ["--index-url https://pypi.org/simple", "-e ./libs/core", "flask==3.0.3  # see https://flask.palletsprojects.com"]),
    file("Pipfile.lock", ['            "url": "https://pypi.org/simple",']),
    file("Gemfile.lock", ["GEM", "  remote: https://rubygems.org/"]),
    file("Cargo.lock", ['source = "sparse+https://index.crates.io/"']),
    file(".npmrc", ["registry=https://registry.npmjs.org/"]),
    // Fixtures hold odd lockfiles on purpose.
    file("tests/fixtures/package-lock.json", ['      "resolved": "http://evil.example/a.tgz",']),
    // Other files can mention URLs freely.
    file("docs/install.md", ['"resolved": "https://evil.example/a.tgz"'])
  ]);

  assert.deepEqual(findings, []);
}

export function testLockfileSourceRuleTellsGemfileGitSectionsApart(): void {
  const [finding] = sourceFindings([
    file("Gemfile.lock", ["GIT", "  remote: https://github.com/acme/patched-gem.git", "  revision: 0123abc", "", "GEM", "  remote: https://rubygems.org/"])
  ]);

  assert.equal(finding?.line, 2);
  assert.equal(finding?.severity, "warning");

  // A hunk inside the GEM section shows the section name after `@@`.
  const patch = ["@@ -1,2 +1,3 @@ GEM", "   remote: https://rubygems.org/", "+  remote: https://gems.evil.example/"].join("\n");
  const [later] = sourceFindings([{ path: "Gemfile.lock", status: "modified", additions: 1, deletions: 0, patch }]);
  assert.equal(later?.severity, "high");
}

export function testLockfileSourceRuleUsesAllowedSources(): void {
  const config = prismConfigSchema.parse({
    rules: { lockfileSources: { allowedSources: ["https://npm.pkg.github.com/", "https://artifactory.acme.example/api/npm/"] } }
  });
  const files = [
    file("package-lock.json", [
      '      "resolved": "https://npm.pkg.github.com/download/@acme/ui/1.0.0/abc",',
      '      "resolved": "https://artifactory.acme.example/api/npm/npm/a/-/a-1.0.0.tgz",',
      '      "resolved": "https://artifactory.acme.example/api/npm-evil/a.tgz",',
      '      "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz",'
    ])
  ];

  const findings = analyzePullRequest(files, config).findings.filter((finding) => finding.ruleId === "lockfile-source");

  // Configured sources are added to the defaults, and a prefix must end at a path boundary.
  assert.deepEqual(
    findings.map((finding) => finding.line),
    [3]
  );
  assert.throws(() => prismConfigSchema.parse({ rules: { lockfileSources: { allowedSources: ["npm.pkg.github.com"] } } }));
}

export function testLockfileSourceRuleReadsPatchesBeforeTheSizeLimitAndRedaction(): void {
  // Lockfile diffs are often over the size limit, and redaction masks credentials inside URLs.
  const filler = Array.from({ length: 3000 }, (_, index) => `      "integrity": "sha512-${"a".repeat(20)}${index}",`);
  const config = prismConfigSchema.parse({ security: { maxPatchBytes: 1000 } });
  const files = prepareChangedFiles(
    [
      file("package-lock.json", [...filler, '      "resolved": "https://user:s3cret@npm.evil.example/a.tgz",']),
      file("yarn.lock", ['  resolved "https://npm.evil.example/b.tgz"'])
    ],
    config
  );

  assert.equal(files[0]?.patch, undefined);
  const findings = analyzePullRequest(files, config).findings.filter((finding) => finding.ruleId === "lockfile-source");
  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      ["package-lock.json", 3001],
      ["yarn.lock", 1]
    ]
  );
  assert.ok(findings.every((finding) => !finding.message.includes("s3cret") && !finding.message.includes("user")));
}

export function testLockfileSourceRuleSeesIgnoredLockfiles(): void {
  // Lockfiles are a common entry in ignorePaths, which must not hide a poisoned URL.
  const config = prismConfigSchema.parse({ ignorePaths: ["**/package-lock.json"] });
  const files = [file("package-lock.json", ['      "resolved": "https://evil.example/a.tgz",'])];

  assert.ok(analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "lockfile-source"));
}

export function testLockfileSourceRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { lockfileSources: { enabled: false } } });
  const files = [file("yarn.lock", ['  resolved "http://evil.example/a.tgz"'])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "lockfile-source"));
}

function sourceFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "lockfile-source");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
