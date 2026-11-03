import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "sanitizer" | "markdown";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  sanitizer: ["configures an HTML sanitizer to keep scripts, event handlers, or javascript: links", "configure an HTML sanitizer to keep scripts, event handlers, or javascript: links"],
  markdown: ["renders raw HTML from Markdown without a sanitizer", "render raw HTML from Markdown without a sanitizer"]
};

// A sanitizer library, by the names its users write, for each language.
const sanitizers: Array<{ files: RegExp; library: RegExp; off: RegExp }> = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/i,
    library: /\bsanitize-?html\b|\bsanitizeHtml\b|\bDOMPurify\b|\bdompurify\b|\bpurify\b/i,
    // sanitize-html with every tag or attribute allowed, or its own vulnerable-tag guard turned off,
    // and DOMPurify allowing any URL scheme.
    off: /\ballowed(?:Tags|Attributes)\s*:\s*false\b|\ballowVulnerableTags\s*:\s*true\b|\bALLOW_UNKNOWN_PROTOCOLS\s*:\s*true\b/
  },
  { files: /\.py$/i, library: /\bbleach\b|\bnh3\b|\bCleaner\s*\(/, off: /(?!)/ },
  { files: /\.go$/i, library: /\bbluemonday\b/, off: /\.AllowUnsafe\s*\(\s*true\s*\)/ },
  { files: /\.(?:java|kt)$/i, library: /\bHtmlPolicyBuilder\b|\bSafelist\b|\bWhitelist\b|\bJsoup\b/, off: /(?!)/ },
  { files: /\.rb$/i, library: /\bsanitize\b|\bLoofah\b|\bRails::Html\b/i, off: /(?!)/ },
  // HTMLPurifier's HTML.Trusted allows script elements.
  { files: /\.php$/i, library: /\bHTMLPurifier/, off: /["']HTML\.Trusted["']\s*(?:,|=>)\s*true\b/ },
  { files: /\.rs$/i, library: /\bammonia\b/, off: /(?!)/ }
];

// An allow list: DOMPurify's ADD_TAGS and ADD_ATTR, sanitize-html's allowed options, bleach's and
// nh3's tags, attributes, and protocols, bluemonday's and the OWASP sanitizer's Allow calls, Jsoup's
// add calls, Rails' tags and attributes, and ammonia's add calls.
const allowList =
  /\b(?:ADD_TAGS|ADD_ATTR|ALLOWED_TAGS|ALLOWED_ATTR|allowedTags|allowedAttributes|allowedSchemes(?:ByTag)?|tags|attributes|protocols|url_schemes|AllowElements|AllowAttrs|AllowURLSchemes|allowElements|allowAttributes|allowUrlProtocols|addTags|addAttributes|addProtocols|add_tags|add_generic_attributes|add_tag_attributes|add_url_schemes)\b\s*(?:[:=(]|\.)/;
const allowLists = new RegExp(allowList.source, "g");
// Where one list's value ends: the next option, as in `{ ADD_TAGS: [...], FORBID_TAGS: [...] }`,
// or the next chained call.
const nextOption = /,\s*[A-Za-z_]\w*\s*[:=](?!=)|\)\s*\./;
// What the list adds: the script element, an event handler attribute, or the javascript scheme.
const dangerousEntry = /["'`](?:script|on[a-z]{3,}|javascript:?)["'`]|%w[([{][^)\]}]*\bscript\b/i;

// Raw HTML in Markdown that a component renders: react-markdown's rehype-raw plugin and old
// react-markdown's escapeHtml, mistune's escape, Parsedown's safe mode, and league/commonmark's
// html_input. Each is safe with a sanitizer step, such as rehype-sanitize, in the same file. Build
// tools such as Astro, MDX, and Gatsby render Markdown the site's authors write, so they are not read.
const rawMarkdown: Array<{ files: RegExp; pattern: RegExp; sanitized: RegExp }> = [
  {
    files: /\.[jt]sx$/i,
    pattern: /\brehypePlugins\s*=\s*\{[^}]*\brehypeRaw\b|\bescapeHtml\s*=\s*\{\s*false\s*\}/,
    sanitized: /\brehype-?[Ss]anitize\b|\bsanitize\b|\bDOMPurify\b/i
  },
  { files: /\.py$/i, pattern: /\bmistune\.(?:create_markdown|Markdown|html)\s*\([^)]*\bescape\s*=\s*False\b/, sanitized: /\bbleach\b|\bnh3\b/ },
  {
    files: /\.php$/i,
    pattern: /->\s*setSafeMode\s*\(\s*false\s*\)|["']html_input["']\s*=>\s*["']allow["']/,
    sanitized: /\bHTMLPurifier\b|\bpurify\b/i
  }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const unsafeHtmlConfigRule: Rule = {
  id: "unsafe-html-config",
  description: "Flags HTML sanitizers configured to keep scripts, event handlers, or javascript: links, and Markdown rendered with raw HTML and no sanitizer.",
  run({ files, config }) {
    if (!config.rules.unsafeHtmlConfig.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const sanitizer = sanitizers.find(({ files: pattern }) => pattern.test(file.path));
      const markdown = rawMarkdown.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (sanitizer === undefined && markdown.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const usesSanitizer = sanitizer !== undefined && lines.some(({ content }) => sanitizer.library.test(content));
      const found: Array<{ line: number; kind: Kind }> = [];
      for (const { line, content, added } of lines) {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        if (usesSanitizer && (sanitizer.off.test(content) || allowsDanger(content))) {
          found.push({ line, kind: "sanitizer" });
        }
        if (markdown.some(({ pattern, sanitized }) => pattern.test(content) && !lines.some(({ content: other }) => sanitized.test(other)))) {
          found.push({ line, kind: "markdown" });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      const weakened = kinds.includes("sanitizer");
      return [
        {
          ruleId: "unsafe-html-config",
          title: weakened ? "HTML sanitizer weakened" : "Raw HTML rendered from Markdown",
          severity: weakened ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, so HTML that users write can run scripts in other users' browsers${
            weakened ? ", even though the code looks sanitized" : ""
          }.`,
          recommendation:
            "Keep the sanitizer's default allow lists and add only the tags and attributes a feature needs, never `script`, `on*` handlers, or the `javascript:` scheme. Render Markdown with raw HTML only together with a sanitizer, such as `rehype-sanitize` after `rehype-raw`, or bleach or HTMLPurifier on the output."
        }
      ];
    });
  }
};

// Whether an allow list on the line adds something dangerous, reading each list's own value only.
function allowsDanger(content: string): boolean {
  for (const match of content.matchAll(allowLists)) {
    const rest = content.slice(match.index + match[0].length);
    const end = nextOption.exec(rest);
    if (dangerousEntry.test(end === null ? rest : rest.slice(0, end.index))) {
      return true;
    }
  }
  return false;
}
