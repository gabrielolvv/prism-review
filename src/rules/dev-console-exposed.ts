import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = {
  label: string;
  high?: boolean;
  files: RegExp;
  pattern: RegExp;
  // Each must appear in one of the lines just before, such as the YAML keys the setting sits under.
  under?: RegExp[];
};

const springFiles = /(?:^|\/)(?:application|bootstrap)[^/]*\.(?:properties|ya?ml)$/i;
// Environment files for production and staging, where Laravel reads APP_DEBUG.
const productionEnv = /(?:^|\/)\.env\.(?:prod|production|staging|live)$/i;

const settings: Setting[] = [
  // Spring Boot's H2 console, which runs SQL and, with web-allow-others, Java code for any visitor.
  { label: "the H2 database console open to other machines", high: true, files: springFiles, pattern: /\bh2\.console\.settings\.web-allow-others\s*[=:]\s*true\b/ },
  { label: "the H2 database console open to other machines", high: true, files: springFiles, pattern: /^\s*web-allow-others\s*:\s*true\b/, under: [/^\s*h2\s*:\s*$/, /^\s*settings\s*:\s*$/] },
  { label: "the H2 database console", files: springFiles, pattern: /\bh2\.console\.enabled\s*[=:]\s*true\b/ },
  { label: "the H2 database console", files: springFiles, pattern: /^\s*enabled\s*:\s*true\b/, under: [/^\s*h2\s*:\s*$/, /^\s*console\s*:\s*$/] },
  // Spring Boot DevTools' remote access, which uploads and runs classes sent with the secret.
  { label: "Spring Boot DevTools' remote access", high: true, files: springFiles, pattern: /\bspring\.devtools\.remote\.secret\s*[=:]\s*\S/ },
  { label: "Spring Boot DevTools' remote access", high: true, files: springFiles, pattern: /^\s*secret\s*:\s*\S/, under: [/^\s*devtools\s*:\s*$/, /^\s*remote\s*:\s*$/] },
  // Rails' web-console, which runs Ruby in the browser, loaded outside development or open to every address.
  { label: "Rails' web console outside development", high: true, files: /\.rb$/i, pattern: /\bconfig\.web_console\.development_only\s*=\s*false\b/ },
  {
    label: "Rails' web console open to every address",
    high: true,
    files: /\.rb$/i,
    pattern: /\bconfig\.web_console\.(?:permissions|whitelisted_ips|allowed_ips)\s*=\s*(?:\[\s*)?["'](?:0\.0\.0\.0\/0|::\/0)["']/
  },
  // The Django Debug Toolbar shown to every visitor, with SQL queries, settings, and templates.
  { label: "the Django Debug Toolbar for every visitor", high: true, files: /\.py$/i, pattern: /["']SHOW_TOOLBAR_CALLBACK["']\s*:\s*(?:lambda[^:]*:\s*True\b|["'][\w.]*show_toolbar_always["'])/ },
  // Flask-DebugToolbar.
  { label: "Flask-DebugToolbar", files: /\.py$/i, pattern: /\bDEBUG_TB_ENABLED["']?\s*\]?\s*[=:]\s*True\b/ },
  // Laravel's debug mode and Debugbar in production settings.
  { label: "Laravel's debug mode in production", files: productionEnv, pattern: /^\s*APP_DEBUG\s*=\s*["']?true\b/i },
  { label: "Laravel's debug mode in production", files: /(?:^|\/)config\/app\.php$/i, pattern: /["']debug["']\s*=>\s*true\b/ },
  { label: "Laravel Debugbar in production", files: productionEnv, pattern: /^\s*DEBUGBAR_ENABLED\s*=\s*["']?true\b/i }
];

// How far above a YAML setting its parent keys may be.
const underWindow = 5;
// A Python or Ruby block that runs only in debug or development mode, as `if DEBUG:` or
// `if Rails.env.development?`.
const debugCheck = /^\s*(?:if|elif|unless|when)\b[^\n]*(?:debug|development|\bdev\b|\blocal\b)/i;
const debugCheckWindow = 40;
// Spring's documents for a development profile, in a multi-document YAML or properties file.
const documentSeparator = /^\s*(?:---|#---)\s*$/;
const developmentProfile = /\b(?:on-profile|profiles)\s*[:=]\s*["']?(?:dev|develop|development|local|test|h2)\b/i;
// Ruby heredocs, such as a gem's own warning that shows the setting.
const heredocStart = /<<[~-]?(["'`]?)([A-Z_][A-Z0-9_]*)\1/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const devConsoleExposedRule: Rule = {
  id: "dev-console-exposed",
  description: "Flags developer consoles and debug toolbars turned on outside development, such as the H2 console, Rails' web-console, and the Django Debug Toolbar.",
  run({ files, config }) {
    if (!config.rules.devConsoleExposed.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development settings turn these on on purpose, such as application-dev.properties.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const ruby = /\.rb$/i.test(file.path);
      const found: Array<{ line: number; label: string; high: boolean }> = [];
      let heredocEnd: RegExp | undefined;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          heredocEnd = undefined;
        }
        if (heredocEnd !== undefined) {
          if (heredocEnd.test(content)) {
            heredocEnd = undefined;
          }
          return;
        }
        const heredoc = ruby ? heredocStart.exec(content) : null;
        if (heredoc !== null) {
          heredocEnd = new RegExp(String.raw`^\s*${heredoc[2] ?? ""}\s*$`);
        }
        if (!added || content.length > maxLineLength || commentLine.test(content) || insideDebugCheck(lines, index) || inDevelopmentProfile(lines, index)) {
          return;
        }
        const setting = fileSettings.find(
          ({ pattern, under }) =>
            pattern.test(content) &&
            (under === undefined || under.every((parent) => lines.slice(Math.max(0, index - underWindow), index).some(({ content: before }) => parent.test(before))))
        );
        if (setting !== undefined) {
          found.push({ line, label: setting.label, high: setting.high === true });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "dev-console-exposed",
          title: "Developer console turned on",
          severity: found.some(({ high }) => high) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "turn on" : "turns on"} ${listOf(labels)}, which ${plural || labels.length > 1 ? "show" : "shows"} SQL queries, settings, and secrets to whoever opens ${plural || labels.length > 1 ? "them" : "it"}, and some of them run SQL or code on the server.`,
          recommendation:
            "Turn developer consoles and toolbars on only in development settings, such as `application-dev.properties`, `config/environments/development.rb`, or a `DEBUG` check, keep them bound to localhost, and set `APP_DEBUG=false` in production."
        }
      ];
    });
  }
};

// Whether the line sits in an `if` block that checks for debug or development mode, found by
// walking up to the lines with less indentation.
function insideDebugCheck(lines: Array<{ content: string; startsHunk?: boolean }>, index: number): boolean {
  let indent = indentation(lines[index]?.content ?? "");
  for (let before = index - 1; before >= Math.max(0, index - debugCheckWindow) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    if (content.trim() !== "" && indentation(content) < indent) {
      if (debugCheck.test(content)) {
        return true;
      }
      indent = indentation(content);
    }
    if (lines[before]?.startsHunk === true) {
      break;
    }
  }
  return false;
}

function indentation(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

// Whether the line is in a Spring document that only applies to a development profile.
function inDevelopmentProfile(lines: Array<{ content: string }>, index: number): boolean {
  let start = index;
  while (start > 0 && !documentSeparator.test(lines[start - 1]?.content ?? "")) {
    start -= 1;
  }
  let end = index + 1;
  while (end < lines.length && !documentSeparator.test(lines[end]?.content ?? "")) {
    end += 1;
  }
  return lines.slice(start, end).some(({ content }) => developmentProfile.test(content));
}
