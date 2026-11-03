import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { subresourceIntegrityRule } from "../../src/rules/subresource-integrity.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return subresourceIntegrityRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSubresourceIntegrityReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("templates/base.html", [
      "<head>",
      "  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\">",
      "  <script src=\"https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js\"></script>",
      "  <script",
      "    src=\"https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js\"",
      "    defer",
      "  ></script>",
      "</head>"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "CDN file without integrity hash");
  assert.deepEqual(finding?.lines, [2, 3, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 3, 4 load scripts and stylesheets from cdn.jsdelivr.net, unpkg.com, and cdnjs.cloudflare.com without an `integrity` hash, so if the package, its publisher's account, or the CDN is compromised, the browser runs whatever is served in every visitor's page, with access to its session and to what users type."
  );
}

export function testSubresourceIntegrityReadsEachKindOfPage(): void {
  const cases: Array<[string, string[], string]> = [
    ["views/layout.ejs", ["<script src=\"https://code.jquery.com/jquery-3.7.1.min.js\"></script>"], "Line 1 loads a script from code.jquery.com"],
    ["app/views/layouts/application.html.erb", ["<link href=\"https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css\" rel=\"stylesheet\">"], "Line 1 loads a stylesheet from stackpath.bootstrapcdn.com"],
    ["src/components/Head.tsx", ["      <script src={\"https://unpkg.com/react@18.3.1/umd/react.production.min.js\"} />"], "Line 1 loads a script from unpkg.com"],
    ["src/App.vue", ["  <link rel=\"modulepreload\" href=\"https://esm.sh/preact@10.24.3\">"], "Line 1 loads a script from esm.sh"],
    [
      "src/playground.ts",
      ["  return `<!DOCTYPE html>", "<script src=\"https://cdn.jsdelivr.net/npm/graphiql@${version}/graphiql.min.js\"></script>`;"],
      "Line 2 loads a script from cdn.jsdelivr.net"
    ],
    ["app/docs.py", ["    swagger_js_url = '<script src=\"//cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js\"></script>'"], "Line 1 loads a script from cdn.jsdelivr.net"]
  ];
  for (const [path, lines, start] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.startsWith(start), `${path}: ${result[0]?.message}`);
  }
}

export function testSubresourceIntegritySkipsHashedAndOtherFiles(): void {
  const cases: Array<[string, string[]]> = [
    // Hashes on the tag, on its own line too, and bound by Vue or JSX.
    [
      "templates/base.html",
      [
        "<script src=\"https://code.jquery.com/jquery-3.7.1.min.js\" integrity=\"sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=\" crossorigin=\"anonymous\"></script>",
        "<link",
        "  rel=\"stylesheet\"",
        "  href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\"",
        "  integrity=\"sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH\"",
        "  crossorigin=\"anonymous\"",
        ">"
      ]
    ],
    ["src/App.vue", ["<script :src=\"cdnUrl\" :integrity=\"hash\"></script>", "<script src=\"https://unpkg.com/vue@3.5.12\" :integrity=\"vueHash\"></script>"]],
    // Your own files, scripts that cannot carry a hash, and links that load nothing.
    ["templates/base.html", ["<script src=\"/static/app.js\"></script>", "<script src=\"https://www.googletagmanager.com/gtag/js?id=G-XXXX\"></script>", "<script src=\"https://js.stripe.com/v3/\"></script>"]],
    ["templates/base.html", ["<link rel=\"preconnect\" href=\"https://cdn.jsdelivr.net\">", "<link rel=\"icon\" href=\"https://unpkg.com/twemoji@14.0.2/2/svg/1f600.svg\">"]],
    ["templates/base.html", ["<link href=\"https://fonts.googleapis.com/css2?family=Inter\" rel=\"stylesheet\">"]],
    // Comments, documentation, and examples.
    ["templates/base.html", ["<!-- <script src=\"https://unpkg.com/htmx.org@2.0.4\"></script> -->"]],
    ["README.md", ["<script src=\"https://unpkg.com/htmx.org@2.0.4\"></script>"]],
    ["examples/cdn/index.html", ["<script src=\"https://unpkg.com/htmx.org@2.0.4\"></script>"]],
    ["src/app.py", ["import requests"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSubresourceIntegritySkipsTestsAndCanBeDisabled(): void {
  const lines = ["<script src=\"https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js\"></script>"];
  assert.deepEqual(findings([added("tests/fixtures/page.html", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { subresourceIntegrity: { enabled: false } } });
  assert.deepEqual(findings([added("templates/base.html", lines)], config), []);
}
