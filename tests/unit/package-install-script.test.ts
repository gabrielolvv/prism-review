import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { packageInstallScriptRule } from "../../src/rules/package-install-script.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return packageInstallScriptRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const manifest = (...scripts: string[]) => ["{", "  \"name\": \"@acme/widgets\",", "  \"version\": \"2.4.0\",", "  \"scripts\": {", ...scripts, "  }", "}"];

export function testPackageInstallScriptReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("package.json", manifest("    \"build\": \"tsc\",", "    \"postinstall\": \"node scripts/setup.js\""))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Install script added to a published package");
  assert.deepEqual(finding?.lines, [6]);
  assert.equal(
    finding?.message,
    "Line 6 adds `postinstall`, which runs code on the machine of everyone who installs this package, before they use it and with their files and credentials. Malware spreads this way, as the Shai-Hulud worm and the compromised nx releases did on npm in 2025, so a package that starts running code at install needs a reason."
  );
}

export function testPackageInstallScriptReadsEachHook(): void {
  const cases: Array<[string, string[]]> = [
    ["packages/cli/package.json", manifest("    \"preinstall\": \"node ./check-env.js\"")],
    ["package.json", manifest("    \"install\": \"node install.js\"")],
    ["setup.py", ["setup(", "    name=\"acme-widgets\",", "    cmdclass={\"install\": PostInstallCommand},", ")"]],
    ["setup.py", ["setup(", "    name=\"acme-widgets\",", "    cmdclass={", "        \"develop\": PostDevelop,", "    },", ")"]],
    ["setup.py", ["        self.cmdclass['install'] = CustomInstall"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPackageInstallScriptSkipsUsualAndPrivatePackages(): void {
  const cases: Array<[string, string[]]> = [
    // Native addon builds, Git hooks, patches, and messages.
    ["package.json", manifest("    \"install\": \"node-gyp-build\"")],
    ["package.json", manifest("    \"install\": \"prebuild-install || node-gyp rebuild\"")],
    ["package.json", manifest("    \"install\": \"cross-env ZERO_AR_DATE=1 node-gyp-build\"")],
    ["package.json", manifest("    \"postinstall\": \"patch-package\"")],
    ["package.json", manifest("    \"postinstall\": \"opencollective-postinstall || exit 0\"")],
    // Other scripts, private packages, and workspace roots.
    ["package.json", manifest("    \"prepare\": \"husky\"", "    \"test\": \"vitest\"")],
    ["package.json", ["{", "  \"name\": \"acme-app\",", "  \"private\": true,", "  \"scripts\": {", "    \"postinstall\": \"node scripts/setup.js\"", "  }", "}"]],
    ["package.json", ["{", "  \"name\": \"acme\",", "  \"workspaces\": [\"packages/*\"],", "  \"scripts\": {", "    \"postinstall\": \"node scripts/link.js\"", "  }", "}"]],
    // Build hooks in setup.py, and vendored packages.
    ["setup.py", ["setup(", "    cmdclass={\"build_ext\": BuildExt},", ")"]],
    ["node_modules/left-pad/package.json", manifest("    \"postinstall\": \"node evil.js\"")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPackageInstallScriptSkipsTestsAndCanBeDisabled(): void {
  const lines = manifest("    \"postinstall\": \"node scripts/setup.js\"");
  assert.deepEqual(findings([added("examples/basic/package.json", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/package.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { packageInstallScript: { enabled: false } } });
  assert.deepEqual(findings([added("package.json", lines)], config), []);
}
