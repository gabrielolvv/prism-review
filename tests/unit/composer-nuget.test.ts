import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";

export function testComposerAndNuGetManifestsAreRead(): void {
  const changes = dependencyChanges([
    changed("composer.json", [
      "@@ -5,6 +5,7 @@",
      '     "require": {',
      '         "php": "^8.2",',
      '+        "ext-json": "*",',
      '-        "guzzlehttp/guzzle": "^7.8",',
      '+        "guzzlehttp/guzzle": "^7.9",',
      '+        "acme/widgets": "dev-main",',
      '         "autoload": { "psr-4": { "App\\\\": "src/" } }'
    ]),
    changed("src/Api/Api.csproj", [
      "@@ -8,3 +8,4 @@",
      '-    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />',
      '+    <PackageReference Version="13.0.3" Include="Newtonsoft.Json" />',
      '+    <PackageReference Include="Serilog.AspNetCore">',
      '     <ProjectReference Include="..\\Core\\Core.csproj" />'
    ]),
    changed("Directory.Packages.props", ["@@ -1 +1,2 @@", '+    <PackageVersion Include="Polly" Version="8.2.0" />']),
    changed("packages.config", ["@@ -1 +1,2 @@", '+  <package id="log4net" version="2.0.15" targetFramework="net48" />'])
  ]);

  assert.deepEqual(
    changes.map(({ file, ecosystem, name, from, to }) => [file, ecosystem, name, from, to]),
    [
      ["composer.json", "Packagist", "guzzlehttp/guzzle", "^7.8", "^7.9"],
      ["composer.json", "Packagist", "acme/widgets", undefined, "dev-main"],
      // The version attribute can come first, and a version given as a child element reads as none.
      ["src/Api/Api.csproj", "NuGet", "Newtonsoft.Json", "13.0.1", "13.0.3"],
      ["src/Api/Api.csproj", "NuGet", "Serilog.AspNetCore", undefined, ""],
      ["Directory.Packages.props", "NuGet", "Polly", undefined, "8.2.0"],
      ["packages.config", "NuGet", "log4net", undefined, "2.0.15"]
    ]
  );
}

export function testComposerAndNuGetGoThroughTheDependencyRules(): void {
  const files = [
    changed("composer.json", ["@@ -1,2 +1,3 @@", '     "require": {', '+        "monolog/monolgo": "^3.0",', '-        "laravel/framework": "^11.0",', '+        "laravel/framework": "^10.0",']),
    changed("src/App/App.csproj", ["@@ -1 +1,2 @@", '+    <PackageReference Include="Newtonsoft.Jsonn" Version="13.0.3" />'])
  ];
  // A packages.lock.json above the project belongs to another project, so it does not count.
  const result = analyzePullRequest(files, defaultConfig, { existingLockfiles: new Set(["composer.lock", "src/packages.lock.json"]) });
  const messages = (ruleId: string) => result.findings.filter((finding) => finding.ruleId === ruleId).map((finding) => finding.message);

  assert.deepEqual(messages("lookalike-dependency"), [
    "Line 2 adds monolog/monolgo (like monolog/monolog): a name one character away from a popular Packagist package, a common way to slip in a malicious one.",
    "Line 1 adds Newtonsoft.Jsonn (like Newtonsoft.Json): a name one character away from a popular NuGet package, a common way to slip in a malicious one."
  ]);
  assert.match(messages("risky-dependency-version")[0] ?? "", /laravel\/framework from \^11\.0 to \^10\.0, an older version/);
  assert.deepEqual(
    result.findings.filter((finding) => finding.ruleId === "stale-lockfile").map((finding) => finding.file),
    ["composer.json"]
  );
}

function changed(path: string, lines: string[]): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch: lines.join("\n")
  };
}
