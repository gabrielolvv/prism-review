import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = {
  label: string;
  files: RegExp;
  pattern: RegExp;
  // Must appear somewhere in the patch, such as the import of the package that lists folders.
  context?: RegExp;
  // Must appear on the line or one of the next lines, such as a servlet parameter's value.
  then?: RegExp;
};

// Server configuration, also when a Kubernetes ConfigMap, Helm chart, or Ansible template holds it.
const configFile = /\.(?:conf|cfg|nginx|vhost|ya?ml|j2|jinja2?|tpl|tmpl|template|erb)$|(?:^|\/)(?:nginx[^/]*|httpd[^/]*|apache2?[^/]*|sites-(?:available|enabled)\/[^/]+|conf\.d\/[^/]+|vhosts?\.d\/[^/]+|\.htaccess|Dockerfile[^/]*)$/i;
const jsFile = /\.(?:[cm]?[jt]s)$/i;

const settings: Setting[] = [
  { label: "nginx", files: configFile, pattern: /^\s*autoindex\s+on\s*;/ },
  // `Options Indexes`, `Options +Indexes`, and `Options All`, which includes it, but not `Options -Indexes`.
  { label: "Apache", files: configFile, pattern: /^\s*Options\s+(?:[+-]?\w+\s+)*\+?(?:Indexes|All)\b/i },
  { label: "lighttpd", files: configFile, pattern: /\b(?:dir-listing\.activate|server\.dir-listing)\s*=\s*["'](?:enable|1)["']/i },
  { label: "Caddy", files: /(?:^|\/)Caddyfile[^/]*$|\.caddy(?:file)?$/i, pattern: /\bfile_server\s+browse\b|^\s*browse\b/ },
  { label: "IIS", files: /\.config$/i, pattern: /<directoryBrowse\b[^>]*\benabled\s*=\s*["']true["']/i },
  // Tomcat's and Jetty's default servlets, in web.xml, and Jetty's ResourceHandler in code.
  {
    label: "Tomcat or Jetty",
    files: /(?:^|\/)(?:web|web-fragment|webdefault|override-web)\.xml$|(?:^|\/)context\.xml$/i,
    pattern: /<param-name>\s*(?:listings|dirAllowed|org\.eclipse\.jetty\.servlet\.Default\.dirAllowed)\s*<\/param-name>/i,
    then: /<param-value>\s*true\s*<\/param-value>/i
  },
  { label: "Jetty", files: /\.(?:java|kt|groovy|scala)$/i, pattern: /\.setDirectoriesListed\s*\(\s*true\s*\)|\.setDirAllowed\s*\(\s*true\s*\)|"dirAllowed"\s*,\s*"true"/ },
  // serve-index for Express and Connect, and @fastify/static's `list` option.
  // A call, but not the package's own definition or its name inside a message.
  { label: "serve-index", files: jsFile, pattern: /(?<![\w.'"`])(?<!function\s+)serveIndex\s*\(/, context: /["']serve-index["']/ },
  { label: "@fastify/static", files: jsFile, pattern: /\blist\s*:\s*(?:true|\{)/, context: /["'](?:@fastify\/static|fastify-static)["']/ },
  // Django's static file view with `show_indexes`.
  { label: "Django", files: /\.py$/i, pattern: /["']show_indexes["']\s*:\s*True\b|\bshow_indexes\s*=\s*True\b/ },
  { label: "ASP.NET Core", files: /\.cs$/i, pattern: /\.UseDirectoryBrowser\s*\(|\bEnableDirectoryBrowsing\s*=\s*true\b/ },
  // Rack::Directory mounted as an app, but not one made only to read its root, as rswag does.
  {
    label: "Rack",
    files: /\.(?:rb|ru)$/i,
    pattern: /\b(?:run|use|mount)\s*\(?\s*Rack::Directory\b|=>\s*Rack::Directory\.new\b|\bRack::Directory\.new\s*\([^)]*\)\s*,?\s*$/
  }
];

// Code that lists folders only in development, behind an environment check.
const condition = /\bif\b|\belif\b|\bunless\b|\?|&&|#if\b/;
const environment = /NODE_ENV|\bENV\b|environment|isDev|IsDevelopment|__DEV__|debug|development|\bdev\b|isProd|IsProduction|production|\bprod\b|Rails\.env|RACK_ENV|settings\.DEBUG/i;
const guardWindow = 2;
const blockWindow = 30;
const thenWindow = 3;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const directoryListingRule: Rule = {
  id: "directory-listing",
  description: "Flags web servers and static file handlers set to list the files in a folder.",
  run({ files, config }) {
    if (!config.rules.directoryListing.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test servers list folders on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const found: Array<{ line: number; label: string }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const setting = active.find(
          ({ pattern, then }) =>
            pattern.test(content) && (then === undefined || lines.slice(index, index + thenWindow + 1).some(({ content: next }) => then.test(next)))
        );
        if (setting === undefined || guarded(lines, index)) {
          return;
        }
        found.push({ line, label: setting.label });
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "directory-listing",
          title: "Directory listing turned on",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "turn on" : "turns on"} directory listing in ${listOf(labels)}, so anyone can browse every file in the served folders, including backups, uploads, source maps, and configuration files that no page links to.`,
          recommendation:
            "Turn listing off, such as `autoindex off`, `Options -Indexes`, or `<directoryBrowse enabled=\"false\" />`, and serve only the files pages link to. For a public download folder, list it on purpose in one location only, and keep everything else out of it."
        }
      ];
    });
  }
};

// Whether an environment check guards the line.
function guarded(lines: Array<{ content: string }>, index: number): boolean {
  const nearby = lines.slice(Math.max(0, index - guardWindow), index + 1).map(({ content }) => content);
  return [...nearby, ...enclosingBlocks(lines, index)].some((content) => condition.test(content) && environment.test(content));
}

// Every line before that opens a block this line is in, from the nearest outward.
function enclosingBlocks(lines: Array<{ content: string }>, index: number): string[] {
  const blocks: string[] = [];
  let indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - blockWindow) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      blocks.push(content);
      indent = start;
    }
  }
  return blocks;
}
