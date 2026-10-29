import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "cors" | "cookie" | "debug";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  cors: "lets any website read responses sent with the user's cookies, by allowing every origin together with credentials",
  cookie: "lets scripts read, or plain HTTP carry, a cookie, by turning off HttpOnly or Secure",
  debug: "turns on a debug mode that shows internals, or runs code, for whoever triggers an error"
};

// Every origin, or the request's own origin sent back: Express cors, the raw header, Django,
// Flask-CORS, Spring, and ASP.NET Core.
const anyOrigin = [
  /\borigin\s*:\s*(?:true\b|["']\*["'])/,
  /Access-Control-Allow-Origin["']?\s*[,:=]\s*(?:["']\*["']|(?:req|request)\.headers?(?:\.origin|\[\s*["']origin["']\s*\]|\.get\(\s*["']origin["']))/i,
  /\bCORS_(?:ALLOW_ALL_ORIGINS|ORIGIN_ALLOW_ALL)\s*=\s*True\b/,
  /\borigins\s*=\s*["']\*["']/,
  /\ballowedOrigin(?:Pattern)?s\s*\(\s*"\*"\s*\)/,
  /\.SetIsOriginAllowed\(\s*_?\w*\s*=>\s*true\s*\)|\.AllowAnyOrigin\(\)/
];
const credentials = [
  /\bcredentials\s*:\s*true\b/,
  /Access-Control-Allow-Credentials["']?\s*[,:=]\s*["']?true\b/i,
  /\bCORS_ALLOW_CREDENTIALS\s*=\s*True\b/,
  /\bsupports_credentials\s*=\s*True\b/,
  /\ballowCredentials\s*(?:\(\s*true\s*\)|=\s*"true")/,
  /\.AllowCredentials\(\)/
];
// How far apart, in lines, an origin and a credentials setting may be to configure the same thing.
const corsReach = 10;
const djangoSetting = /\bCORS_[A-Z_]{1,40}\s*=/;
// A whole `cors({ ... })` call on one line holds its own options, so it pairs only with itself.
const wholeCorsCall = /\bcors\s*\(\s*\{[^}]{0,1000}\}\s*\)/i;
// Only settings that are about cookies: a bare `secure: false` is also an SMTP and a proxy option.
const cookieFlags = [
  /\bhttpOnly\s*:\s*false\b/i,
  /\b(?:SESSION|CSRF)_COOKIE_(?:SECURE|HTTPONLY)\s*=\s*False\b/,
  /\bset_cookie\s*\([^)]{0,500}\b(?:httponly|secure)\s*=\s*False\b/,
  /\b(?:res|response|reply)\.cookie\s*\([^)]{0,500}\b(?:httpOnly|secure)\s*:\s*false\b/,
  /\.set(?:HttpOnly|Secure)\s*\(\s*false\s*\)/,
  /\bHttpOnly\s*=\s*false\b/
];
const flaskDebug = /\.run\s*\([^)]{0,500}\b(?:debug|use_debugger)\s*=\s*True\b/;
const djangoDebug = /^\s*DEBUG\s*=\s*True\b/;
const railsLocalErrors = /\bconfig\.consider_all_requests_local\s*=\s*true\b/;

// Settings modules, but not the ones meant for development or tests.
const djangoSettings = /(?:^|\/)settings(?:\/[\w.-]+|[\w.-]*)\.py$/;
const developmentPath = /(?:^|[\/_.-])(?:dev|develop|development|local|test|testing|ci|examples?|samples?|demos?)(?:[\/_.-]|$)/i;
const railsProduction = /(?:^|\/)config\/environments\/production\.rb$/;

const commentLine = /^\s*(?:#|\/\/|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const insecureWebConfigRule: Rule = {
  id: "insecure-web-config",
  description: "Flags CORS that allows every origin with credentials, cookies without HttpOnly or Secure, and debug modes in production.",
  run({ files, config }) {
    if (!config.rules.insecureWebConfig.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findSettings(file.path, file.patch);
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const high = listed.includes("cors");
      const lines = [...new Set(found.map((match) => match.line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "insecure-web-config",
          title: high ? "CORS allows every origin with credentials" : "Insecure web configuration",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "change" : "changes"} web configuration in a way that ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "List the origins allowed to send credentials, keep HttpOnly and Secure on session and authentication cookies, and turn debug modes on only in development settings."
        }
      ];
    });
  }
};

function findSettings(path: string, patch: string): Array<{ line: number; kind: Kind }> {
  const lines = patchLines(patch).filter(({ content }) => !commentLine.test(content));
  const found: Array<{ line: number; kind: Kind }> = [];

  // CORS is only a problem when both halves configure the same thing, and one of them is added by
  // the pull request. They must be close together, so a public route's `origin: "*"` and another
  // route's credentials are not paired, except Django's settings, which apply to the whole app.
  const origins = lines.filter(({ content }) => anyOrigin.some((pattern) => pattern.test(content)));
  const withCredentials = lines.filter(({ content }) => credentials.some((pattern) => pattern.test(content)));
  const paired = (left: PatchLine, right: PatchLine) =>
    left.line === right.line ||
    (!wholeCorsCall.test(left.content) &&
      !wholeCorsCall.test(right.content) &&
      (Math.abs(left.line - right.line) <= corsReach || (djangoSetting.test(left.content) && djangoSetting.test(right.content))));
  for (const origin of origins) {
    for (const credential of withCredentials.filter((entry) => paired(origin, entry))) {
      for (const entry of [origin, credential]) {
        if (entry.added) {
          found.push({ line: entry.line, kind: "cors" });
        }
      }
    }
  }

  const djangoProduction = djangoSettings.test(path) && !developmentPath.test(path);
  for (const { line, content, added } of lines) {
    if (!added) {
      continue;
    }
    if (cookieFlags.some((pattern) => pattern.test(content))) {
      found.push({ line, kind: "cookie" });
    }
    if (
      flaskDebug.test(content) ||
      (djangoProduction && djangoDebug.test(content)) ||
      (railsProduction.test(path) && railsLocalErrors.test(content))
    ) {
      found.push({ line, kind: "debug" });
    }
  }

  return found;
}

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
