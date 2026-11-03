import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unsafeHtmlConfigRule } from "../../src/rules/unsafe-html-config.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unsafeHtmlConfigRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUnsafeHtmlConfigReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/comments/render.ts", [
      "import DOMPurify from 'dompurify';",
      "export function render(html: string) {",
      "  return DOMPurify.sanitize(html, {",
      "    ADD_TAGS: ['iframe', 'script'],",
      "    ADD_ATTR: ['allowfullscreen', 'onload'],",
      "  });",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "HTML sanitizer weakened");
  assert.deepEqual(finding?.lines, [4, 5]);
  assert.equal(
    finding?.message,
    "Lines 4, 5 configure an HTML sanitizer to keep scripts, event handlers, or javascript: links, so HTML that users write can run scripts in other users' browsers, even though the code looks sanitized."
  );
}

export function testUnsafeHtmlConfigReadsEachLibrary(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["src/sanitize.js", ["const sanitizeHtml = require('sanitize-html');", "const clean = sanitizeHtml(dirty, { allowedTags: false, allowedAttributes: false });"], "high"],
    ["src/sanitize.js", ["import sanitizeHtml from 'sanitize-html';", "sanitizeHtml(dirty, { allowedTags: ['b', 'script'], allowVulnerableTags: true });"], "high"],
    ["src/sanitize.js", ["import sanitizeHtml from 'sanitize-html';", "sanitizeHtml(dirty, { allowedSchemes: ['http', 'https', 'javascript'] });"], "high"],
    ["src/purify.ts", ["import DOMPurify from 'dompurify';", "DOMPurify.sanitize(html, { ALLOW_UNKNOWN_PROTOCOLS: true });"], "high"],
    ["app/markup.py", ["import bleach", "TAGS = ['p', 'a', 'script']", "clean = bleach.clean(text, tags=TAGS + ['script'])"], "high"],
    ["app/markup.py", ["import nh3", "nh3.clean(text, attributes={'a': {'href', 'onclick'}})"], "high"],
    ["markup/sanitize.go", ["p := bluemonday.UGCPolicy()", "p.AllowElements(\"script\")"], "high"],
    ["markup/sanitize.go", ["p := bluemonday.NewPolicy()", "p.AllowUnsafe(true)"], "high"],
    ["src/Sanitizer.java", ["PolicyFactory policy = new HtmlPolicyBuilder()", "    .allowElements(\"p\", \"script\")", "    .toFactory();"], "high"],
    ["app/helpers/markup_helper.rb", ["def render_body(body)", "  sanitize(body, tags: %w(p a script))", "end"], "high"],
    ["src/Markup.php", ["$config = HTMLPurifier_Config::createDefault();", "$config->set('HTML.Trusted', true);"], "high"],
    ["src/components/Comment.tsx", ["import ReactMarkdown from 'react-markdown';", "import rehypeRaw from 'rehype-raw';", "<ReactMarkdown rehypePlugins={[rehypeRaw]}>{comment.body}</ReactMarkdown>"], "warning"],
    ["app/render.py", ["markdown = mistune.create_markdown(escape=False)"], "warning"],
    ["src/Markdown.php", ["$parsedown = new Parsedown();", "$parsedown->setSafeMode(false);"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnsafeHtmlConfigSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Narrow additions, such as iframes for embeds, and lists that forbid scripts.
    ["src/purify.ts", ["import DOMPurify from 'dompurify';", "DOMPurify.sanitize(html, { ADD_TAGS: ['iframe'], FORBID_TAGS: ['script', 'style'] });"]],
    ["src/sanitize.js", ["import sanitizeHtml from 'sanitize-html';", "sanitizeHtml(dirty, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']) });"]],
    // A list of tags to remove, outside a sanitizer.
    ["app/scrape.py", ["tags = ['script', 'style']", "for tag in soup(tags):", "    tag.decompose()"]],
    // Raw HTML with a sanitizer after it, and build tools that render the site's own Markdown.
    [
      "src/components/Comment.tsx",
      ["import rehypeRaw from 'rehype-raw';", "import rehypeSanitize from 'rehype-sanitize';", "<ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{body}</ReactMarkdown>"]
    ],
    ["packages/markdown/src/index.ts", ["import rehypeRaw from 'rehype-raw';", "processor.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw);"]],
    ["app/render.py", ["import bleach", "markdown = mistune.create_markdown(escape=False)", "html = bleach.clean(markdown(text))"]],
    ["src/purify.ts", ["// DOMPurify.sanitize(html, { ADD_TAGS: ['script'] });"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnsafeHtmlConfigSkipsTestsAndCanBeDisabled(): void {
  const lines = ["import DOMPurify from 'dompurify';", "DOMPurify.sanitize(html, { ADD_TAGS: ['script'] });"];
  assert.deepEqual(findings([added("src/purify.test.ts", lines), added("fixtures/purify.ts", lines), added("docs/purify.md", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { unsafeHtmlConfig: { enabled: false } } });
  assert.deepEqual(findings([added("src/purify.ts", lines)], config), []);
}
