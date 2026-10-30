import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unescapedHtmlRule } from "../../src/rules/unescaped-html.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unescapedHtmlRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Built at run time, so this file does not hold the forms it tests.
const vHtml = ["v", "html"].join("-");
const safeCall = ["mark", "safe"].join("_");

export function testUnescapedHtmlReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("templates/post.html", ["<h1>{{ post.title }}</h1>", `<div>{{ post.body|${"safe"} }}</div>`, `<div ${vHtml}="post.summary"></div>`])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "HTML written without escaping");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    `Lines 2, 3 write values into the page without HTML escaping (|safe or |raw, ${vHtml}), so a value that holds user input can run scripts in the page (cross-site scripting).`
  );
}

export function testUnescapedHtmlReadsEachTemplateEngine(): void {
  const cases: Array<[string, string]> = [
    ["src/components/Post.vue", `<div ${vHtml}="post.body"></div>`],
    ["src/routes/Post.svelte", `<div>{${"@html"} post.body}</div>`],
    ["src/app/post.component.ts", `this.html = this.sanitizer.${"bypassSecurityTrust"}Html(post.body);`],
    ["templates/post.html", `{% autoescape ${"off"} %}`],
    ["templates/post.twig", `{{ post.body|${"raw"} }}`],
    ["views/post.hbs", "<div>{{{post.body}}}</div>"],
    ["views/post.mustache", "<div>{{& post.body}}</div>"],
    ["views/post.ejs", `<div><%${"-"} post.body %></div>`],
    ["resources/views/post.blade.php", `<div>{${"!!"} $post->body !!}</div>`],
    ["app/views/posts/show.html.erb", `<div><%${"=="} @post.body %></div>`],
    ["app/views/posts/show.html.haml", "%div!= @post.body"],
    ["app/views/posts/show.html.slim", "div == @post.body"],
    ["views/post.pug", "div!= post.body"],
    ["views/post.pug", "p Hello !{user.name}"],
    ["src/main/resources/templates/post.html", `<div th:${"utext"}="\${post.body}"></div>`],
    ["WEB-INF/post.jsp", `<c:out value="\${post.body}" escapeXml="${"false"}"/>`],
    ["app/views.py", `return ${safeCall}(f'<b>{name}</b>')`],
    ["app/models.py", `return ${"Markup"}("<h2>" + self.name + "</h2>")`],
    ["app/render.py", `env = Environment(loader=loader, autoescape=${"False"})`]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testUnescapedHtmlSkipsTextAndEscapedValues(): void {
  const cases: Array<[string, string]> = [
    // Text written in the template, translated or not.
    ["src/components/Post.vue", `<div ${vHtml}="'<br>'"></div>`],
    ["templates/post.html", `{{ _('<b>Note</b>')|${"safe"} }}`],
    ["app/views.py", `return ${safeCall}("<br>")`],
    ["app/views.py", `return ${safeCall}(_('<b>Note</b>'))`],
    // Escaped output, and values another step already escaped.
    ["templates/post.html", "<div>{{ post.body }}</div>"],
    ["templates/post.html", `var data = {{ data | tojson | ${"safe"} }};`],
    ["templates/post.html", `{{ field.help_text|${"safe"} }}`],
    ["app/views.py", "return format_html('<b>{}</b>', name)"],
    ["app/views.py", `out = ${"Markup"}('<b>%s</b>') % name`],
    // Angular sanitizes [innerHTML] itself.
    ["src/app/post.component.html", '<div [innerHTML]="post.body"></div>'],
    // Layouts and includes.
    ["views/layout.hbs", "{{{body}}}"],
    ["views/post.ejs", `<%${"-"} include('header') %>`],
    ["templates/app.js.ejs", `var x = <%${"-"} value %>;`],
    ["src/main/resources/templates/post.html", `<p th:${"utext"}="#{home.welcome}"></p>`],
    // Code, comments, and lines a reviewer marked.
    ["views/post.pug", "- if (a != b)"],
    ["app/views/posts/show.html.slim", "- if a == b"],
    ["templates/post.html", `{# {{ post.body|${"safe"} }} #}`],
    ["app/views.py", `return ${safeCall}(html)  # nosec reviewed`]
  ];
  for (const [path, line] of cases) {
    assert.deepEqual(findings([added(path, [line])]), [], `${path}: ${line}`);
  }
}

export function testUnescapedHtmlSkipsTestsDocsAndOtherFiles(): void {
  const line = `<div>{{ post.body|${"safe"} }}</div>`;

  assert.deepEqual(
    findings([
      added("tests/templates/post.html", [line]),
      added("docs/templates/post.html", [line]),
      added("README.md", [line]),
      added("src/post.go", [line])
    ]),
    []
  );
}

export function testUnescapedHtmlCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { unescapedHtml: { enabled: false } } });

  assert.deepEqual(findings([added("templates/post.html", [`{{ post.body|${"safe"} }}`])], config), []);
}
