import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// Public CDNs that serve packages and libraries anyone can publish to or that serve many sites, so
// a compromised package, account, or CDN reaches every page that loads from them.
const publicCdn =
  /^(?:https?:)?\/\/((?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|gcore\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|(?:stackpath|maxcdn|netdna)\.bootstrapcdn\.com|ajax\.googleapis\.com|ajax\.aspnetcdn\.com|cdn\.datatables\.net|cdn\.bootcdn\.net|cdn\.bootcss\.com|cdn\.staticfile\.(?:org|net)|lib\.baomitu\.com|esm\.sh|cdn\.skypack\.dev|ga\.jspm\.io|cdn\.rawgit\.com|(?:raw|rawcdn)\.githack\.com|cdn\.statically\.io|code\.ionicframework\.com|cdn\.plot\.ly|d3js\.org|cdn\.ckeditor\.com|use\.fontawesome\.com(?=\/releases\/)))\//i;

// Pages, templates, and components, and code that writes HTML into strings, such as a GraphQL
// playground's page.
const markupFile =
  /\.(?:html?|xhtml|ejs|hbs|handlebars|mustache|njk|nunjucks|jinja2?|j2|twig|erb|php|phtml|jsx|tsx|vue|svelte|astro|cshtml|razor|jsp|liquid|tpl|gohtml|tmpl|[cm]?[jt]s|py|rb|go|java|kt|cs)$/i;
const tagStart = /<(script|link)\b/gi;
const tagLines = 10;
const source = /\b(?:src|href)\s*=\s*["'{]?\s*["'`]?((?:https?:)?\/\/[^"'`\s>]+)/i;
// Stylesheets and module preloads run or style the page; icons, preconnects, and other links do not.
const loadedLink = /\brel\s*=\s*["']?(?:[\w-]+\s+)*(?:stylesheet|modulepreload)\b/i;
// `integrity="sha384-..."`, Vue's `:integrity`, and JSX's `integrity={...}`.
const integrity = /(?:^|[\s:])integrity\s*=/i;

const commentLine = /^\s*(?:<!--|#|\/\/|\/\*|\*|\{#|<%--|@\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc)$/i;
const maxLineLength = 2_000;

export const subresourceIntegrityRule: Rule = {
  id: "subresource-integrity",
  description: "Flags scripts and stylesheets loaded from public CDNs without an integrity hash.",
  run({ files, config }) {
    if (!config.rules.subresourceIntegrity.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !markupFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, demo, and test pages are not served to users.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; host: string; stylesheet: boolean }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        for (const match of content.matchAll(tagStart)) {
          const tag = readTag(lines, index, match.index);
          const url = source.exec(tag)?.[1];
          const host = url === undefined ? undefined : publicCdn.exec(url)?.[1]?.toLowerCase();
          const link = match[1]?.toLowerCase() === "link";
          if (host === undefined || integrity.test(tag) || (link && !loadedLink.test(tag))) {
            continue;
          }
          // A module preload loads a script.
          const stylesheet = link && !/\bmodulepreload\b/i.test(tag);
          found.push({ line, host, stylesheet });
          break;
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const scripts = found.some(({ stylesheet }) => !stylesheet);
      const stylesheets = found.some(({ stylesheet }) => stylesheet);
      const what = scripts && stylesheets ? "scripts and stylesheets" : scripts ? (plural ? "scripts" : "a script") : plural ? "stylesheets" : "a stylesheet";
      const hosts = [...new Set(found.map(({ host }) => host))];
      return [
        {
          ruleId: "subresource-integrity",
          title: "CDN file without integrity hash",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "load" : "loads"} ${what} from ${listOf(hosts)} without an \`integrity\` hash, so if the package, its publisher's account, or the CDN is compromised, the browser runs whatever is served in every visitor's page, with access to its session and to what users type.`,
          recommendation:
            "Pin an exact version and add `integrity=\"sha384-...\"` with `crossorigin=\"anonymous\"`, using the hash the CDN publishes or one from `openssl dgst -sha384 -binary file | openssl base64 -A`. Better still, install the package and serve it from your own build."
        }
      ];
    });
  }
};

// The tag that starts at `start` on line `index`, up to its closing `>`, across up to 10 lines.
function readTag(lines: Array<{ content: string }>, index: number, start: number): string {
  let tag = (lines[index]?.content ?? "").slice(start);
  for (let next = index + 1; !tag.includes(">") && next < Math.min(lines.length, index + tagLines); next += 1) {
    tag += ` ${lines[next]?.content ?? ""}`;
  }
  const end = tag.indexOf(">");
  return end === -1 ? tag : tag.slice(0, end);
}
