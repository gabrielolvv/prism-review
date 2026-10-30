import { minimatch } from "minimatch";
import { addedLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Each form writes a value into HTML without escaping it. `expr` is the value, when there is one: a
// value written as text in the template, such as `v-html="'<br>'"`, is not reported. risky-api
// already covers innerHTML, React's raw HTML prop, Rails' html_safe and raw, Html.Raw, and
// template.HTML, so they are left out here.
type Form = { label: string; files: RegExp; pattern: RegExp; skip?: RegExp };

const htmlTemplates = /\.(?:html?|jinja2?|j2|njk|nunjucks|twig|djhtml|liquid)$/i;
const scripts = /\.(?:[cm]?[jt]sx?|vue)$/i;

const forms: Form[] = [
  // Vue, in single-file components, HTML, and templates written in script files.
  { label: "v-html", files: /\.(?:vue|html?|[cm]?[jt]sx?)$/i, pattern: /\bv-html\s*=\s*(["'])(?<expr>(?:(?!\1).)*)\1/g },
  { label: "{@html}", files: /\.svelte$/i, pattern: /\{@html\s+(?<expr>[^}]*)\}/g },
  // Angular sanitizes [innerHTML] by default; these calls turn that off for one value.
  {
    label: "bypassSecurityTrust",
    files: scripts,
    pattern: /\.bypassSecurityTrust(?:Html|Script|Style|Url|ResourceUrl)\s*\(\s*(?<expr>[^)]*)/g
  },
  // Jinja, Django, and Nunjucks `|safe`, and Twig's `|raw`. Django forms' help text is written by the
  // developer, and filters such as `tojson` already escape the value.
  {
    label: "|safe or |raw",
    files: htmlTemplates,
    pattern: /\{\{-?\s*(?<expr>[^{}]*?)\s*\|\s*(?:safe|raw)\b[^{}]*\}\}/g,
    skip: /(?:^|\.)help_text$|\|\s*(?:tojson|json_script|escapejs|escape|e|urlencode|striptags|json_encode)\b/
  },
  { label: "autoescape off", files: htmlTemplates, pattern: /\{%-?\s*autoescape\s+(?:off|false)\b/g },
  // Handlebars and Mustache. `{{{body}}}` is where express-handlebars puts the rendered page.
  {
    label: "triple-stash",
    files: /\.(?:hbs|handlebars|mustache|html?)$/i,
    pattern: /\{\{\{\s*(?<expr>[^{}]*?)\s*\}\}\}|\{\{&\s*(?<expr2>[^{}]*?)\s*\}\}/g,
    skip: /^(?:body|yield|outlet)$/
  },
  // EJS's `<%-` writes without escaping; `<%- include(...) %>` adds another template.
  { label: "<%-", files: /(?<!\.(?:[cm]?[jt]sx?|json|ya?ml|sh|css|md|txt|py|toml|env))\.ejs$/i, pattern: /<%-\s*(?<expr>(?:(?!%>).)*?)\s*-?%>/g, skip: /^include\b/ },
  { label: "{!! !!}", files: /\.blade\.php$/i, pattern: /\{!!\s*(?<expr>(?:(?!!!\}).)*?)\s*!!\}/g },
  { label: "<%==", files: /\.erb$/i, pattern: /<%==\s*(?<expr>(?:(?!%>).)*?)\s*-?%>/g },
  // Haml's `!=`, Slim's `==`, and Pug's `!=` and `!{...}`. Lines starting with `-` are code.
  { label: "!=", files: /\.haml$/i, pattern: /^\s*(?:[%.#][\w.#-]*(?:\{[^}]*\}|\([^)]*\))?)?\s*!=\s*(?<expr>.+)$/g },
  { label: "==", files: /\.slim$/i, pattern: /^\s*(?:[a-z][\w.#-]*)?\s*==\s*(?<expr>.+)$/gi },
  {
    label: "!= or !{}",
    files: /\.(?:pug|jade)$/i,
    pattern: /^\s*(?:[\w.#-]*\w(?:\([^)]*\))?)?!=\s*(?<expr>.+)$|!\{(?<expr2>[^}]*)\}/g
  },
  // Thymeleaf. `#{...}` reads a message from the application's own message files.
  { label: "th:utext", files: /\.html?$/i, pattern: /\bth:utext\s*=\s*(["'])(?<expr>(?:(?!\1).)*)\1/g, skip: /^#\{/ },
  { label: 'escapeXml="false"', files: /\.(?:jspx?|tag)$/i, pattern: /<c:out\b[^>]*\bescapeXml\s*=\s*["']false["']/g },
  // Python: Django's mark_safe and SafeString, MarkupSafe's Markup, and Jinja without autoescaping.
  // `Markup("<b>%s</b>") % value` escapes the value, so only what is inside the call is checked.
  { label: "mark_safe or Markup", files: /\.py$/i, pattern: /(?<![.\w])(?:mark_safe|SafeString|Markup)\s*\(\s*(?<expr>[^)]*)/g },
  { label: "autoescape=False", files: /\.py$/i, pattern: /\bautoescape\s*=\s*False\b/g }
];

// Translations of written text, such as `_("<b>Note</b>")`, are as safe as the text.
const literalParts = /(["'])(?:\\.|(?!\1).)*\1|\b(?:_|gettext\w*|ugettext\w*|pgettext\w*|ngettext\w*|trans|__)\b|[()+,\s]|^\d+$/g;
const quoted = /["']/;
// Lines a security linter's reviewer already marked, such as Bandit's `# nosec`.
const reviewed = /#\s*nosec\b|nosemgrep/;
const commentLine = /^\s*(?:<!--|\{#|\{\{!|\/\/|#(?!\{)|\*|\/\*|-#|\/[^/])/;
// Unlike other rules, HTML files are read here, except under a documentation directory.
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$|(?:^|\/)docs?\//i;
const maxLineLength = 2_000;

export const unescapedHtmlRule: Rule = {
  id: "unescaped-html",
  description: "Flags template output and calls that write a value into HTML without escaping it.",
  run({ files, config }) {
    if (!config.rules.unescapedHtml.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (file.patch === undefined || documentation.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }
      const fileForms = forms.filter((form) => form.files.test(file.path));
      if (fileForms.length === 0) {
        return [];
      }

      const found = addedLines(file.patch).flatMap(({ line, content }) =>
        content.length > maxLineLength || commentLine.test(content) || reviewed.test(content)
          ? []
          : fileForms.filter((form) => writesValue(form, content)).map((form) => ({ line, label: form.label }))
      );
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = [...new Set(found.map((match) => match.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "unescaped-html",
          title: "HTML written without escaping",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} into the page without HTML escaping (${kinds.join(", ")}), so a value that holds user input can run scripts in the page (cross-site scripting).`,
          recommendation:
            "Let the template escape the value. When it must hold HTML, sanitize it first with a library such as DOMPurify, sanitize-html, bleach, or nh3, and mark only the sanitized result as safe."
        }
      ];
    });
  }
};

function writesValue(form: Form, content: string): boolean {
  form.pattern.lastIndex = 0;
  for (const match of content.matchAll(form.pattern)) {
    const groups = match.groups ?? {};
    const expr = (groups.expr ?? groups.expr2)?.trim();
    // Forms without a value, such as autoescape off, always count.
    if (expr === undefined && !("expr" in groups)) {
      return true;
    }
    if (expr === undefined || expr === "" || isWrittenText(expr) || form.skip?.test(expr)) {
      continue;
    }
    return true;
  }
  return false;
}

// True when the value is only quoted text, possibly translated or joined with other text.
function isWrittenText(expr: string): boolean {
  return quoted.test(expr) && expr.replace(literalParts, "") === "";
}
