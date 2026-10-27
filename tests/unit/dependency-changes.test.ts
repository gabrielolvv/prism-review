import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { renderJson } from "../../src/reporting/render-json.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

export function testDependencyChangesAcrossManifests(): void {
  const changes = dependencyChanges([
    changed("package.json", [
      "@@ -10,6 +10,7 @@",
      '   "dependencies": {',
      '-    "lodash": "4.17.20",',
      '+    "lodash": "4.17.21",',
      '+    "axios": "^1.6.0 || ^2.0.0",',
      '-    "left-pad": "^1.3.0",',
      // Moved lines keep their version, so they did not change.
      '-    "yaml": "^2.8.0",',
      '+    "yaml": "^2.8.0",',
      '-  "version": "1.0.0",',
      '+  "version": "1.1.0",',
      '     "react": "^18.2.0"'
    ]),
    changed("requirements.txt", ["@@ -1,2 +1,2 @@", "-Django==4.2", "+django==5.0", "+requests", "-flask>=2.0  # web"]),
    changed("Cargo.toml", [
      "@@ -5,3 +5,4 @@",
      " [dependencies]",
      '-serde = "1.0.190"',
      '+serde = { version = "1.0.193", features = ["derive"] }',
      '+mylib = { git = "https://example.com/mylib.git" }'
    ]),
    changed("Gemfile", ["@@ -1 +1,2 @@", "+gem 'rails', '~> 7.1'", "+gem 'puma'"]),
    changed("fixtures/package.json", ["@@ -0,0 +1 @@", '+    "express": "^4.0.0"'])
  ]);

  assert.deepEqual(
    changes.map(({ file, name, from, to }) => [file, name, from, to]),
    [
      ["package.json", "lodash", "4.17.20", "4.17.21"],
      ["package.json", "axios", undefined, "^1.6.0 || ^2.0.0"],
      ["package.json", "left-pad", "^1.3.0", undefined],
      // PyPI names compare like PyPI does, so Django and django are the same package.
      ["requirements.txt", "django", "==4.2", "==5.0"],
      ["requirements.txt", "requests", undefined, ""],
      ["requirements.txt", "flask", ">=2.0", undefined],
      ["Cargo.toml", "serde", "1.0.190", "1.0.193"],
      ["Cargo.toml", "mylib", undefined, ""],
      ["Gemfile", "rails", undefined, "~> 7.1"],
      ["Gemfile", "puma", undefined, ""]
    ]
  );
}

export function testDependencyChangesAreListedInTheReview(): void {
  const files = [
    changed("package.json", ["@@ -1,2 +1,2 @@", '-    "lodash": "4.17.20",', '+    "lodash": "4.17.21",', '+    "axios": "^1.6.0 || ^2.0.0",']),
    changed("src/odd|`name`/requirements.txt", ["@@ -0,0 +1 @@", "+requests==2.31.0"])
  ];
  const result = analyzePullRequest(files, defaultConfig);
  const markdown = renderMarkdown(result);

  assert.match(
    markdown,
    /^### Dependency Changes\n\n\| File \| Package \| Change \|\n\| --- \| --- \| --- \|\n\| `package\.json` \| `lodash` \| `4\.17\.20` to `4\.17\.21` \|\n\| `package\.json` \| `axios` \| added `\^1\.6\.0 \\\|\\\| \^2\.0\.0` \|\n/m
  );
  // A path with a pipe and backticks stays in its cell.
  assert.ok(markdown.includes("| ``src/odd\\|`name`/requirements.txt`` | `requests` | added `==2.31.0` |"));

  assert.doesNotMatch(renderMarkdown(result, { includeLowSeverity: false, dependencyChanges: false }), /Dependency Changes/);
  assert.equal(prismConfigSchema.parse({}).comment.dependencyChanges, true);
  assert.deepEqual(JSON.parse(renderJson(result)).dependencyChanges[0], {
    file: "package.json",
    ecosystem: "npm",
    name: "lodash",
    from: "4.17.20",
    to: "4.17.21"
  });
  assert.deepEqual(JSON.parse(renderJson(analyzePullRequest([], defaultConfig))).dependencyChanges, []);
}

export function testDependencyChangesShareTheCommentSizeLimit(): void {
  const longPath = `${"very-long-directory-name/".repeat(150)}package.json`;
  const files = Array.from({ length: 40 }, (_, index) =>
    changed(index === 0 ? longPath : `packages/p${index}/package.json`, ["@@ -0,0 +1 @@", `+    "dep-${index}": "^1.0.0"`])
  );
  const markdown = renderMarkdown(analyzePullRequest(files, defaultConfig));
  const section = markdown.slice(markdown.indexOf("### Dependency Changes"), markdown.indexOf("### Suggested Review Checklist"));

  assert.ok(section.length < 9_000, `${section.length} characters`);
  assert.match(section, /^\d+ more dependency change\(s\) are not shown\.$/m);
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
