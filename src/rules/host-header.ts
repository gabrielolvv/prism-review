import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Kind = "link" | "allowAll";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  link: ["builds a link sent by email from the request's Host header", "build links sent by email from the request's Host header"],
  allowAll: ["accepts requests for any host name", "accept requests for any host name"]
};

// Host validation turned off: Django's ALLOWED_HOSTS with `*`, and Rails' host authorization
// cleared.
const allowAll: Array<{ files: RegExp; pattern: RegExp }> = [
  { files: /\.py$/i, pattern: /^\s*ALLOWED_HOSTS\s*(?:=|\+=)[^#\n]*["']\*["']/ },
  { files: /(?:^|\/)config\/(?:application|environments\/[^/]+)\.rb$/i, pattern: /\bconfig\.hosts\s*(?:\.clear\b|=\s*nil\b)/ }
];

// The host the client sent, unchecked: the Host header and X-Forwarded-Host, and the values frameworks
// derive from them.
const hostSource: Array<{ files: RegExp; pattern: RegExp }> = [
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    pattern:
      /\b(?:req|request)\.headers(?:\.host\b|\[\s*["'](?:x-forwarded-)?host["']\s*\])|\b(?:req|request)\.(?:get|header)\s*\(\s*["'](?:x-forwarded-)?host["']\s*\)|\b(?:req|request)\.headers\.get\s*\(\s*["'](?:x-forwarded-)?host["']\s*\)|\breq\.(?:hostname|host)\b|\bctx\.(?:request\.)?(?:host|hostname|origin)\b/i
  },
  // Django's get_host() and build_absolute_uri() check ALLOWED_HOSTS; reading META does not.
  {
    files: /\.py$/i,
    pattern: /\brequest\.META(?:\[\s*|\.get\s*\(\s*)["']HTTP_(?:X_FORWARDED_)?HOST["']|\brequest\.(?:host|host_url|url_root)\b|\brequest\.headers(?:\[\s*|\.get\s*\(\s*)["'](?:X-Forwarded-)?Host["']/i
  },
  { files: /\.php$/i, pattern: /\$_SERVER\s*\[\s*["']HTTP_(?:X_FORWARDED_)?HOST["']\s*\]|->\s*(?:getHost|getHttpHost|getSchemeAndHttpHost)\s*\(\s*\)/ },
  { files: /\.(?:java|kt)$/i, pattern: /\brequest\.(?:getHeader\s*\(\s*"(?:X-Forwarded-)?Host"\s*\)|getServerName\s*\(\s*\))/i },
  { files: /\.go$/i, pattern: /\b(?:r|req)\.Host\b|\b(?:r|req)\.Header\.Get\s*\(\s*"(?:X-Forwarded-)?Host"\s*\)/i },
  { files: /\.rb$/i, pattern: /\brequest\.(?:host|host_with_port|base_url)\b/ }
];

// The line puts the host into a URL.
const buildsUrl = /\/\/|https?|url|link|href|uri/i;
// Words of a flow that mails a link. `token` alone is not one, since session, OAuth, and API code
// use it everywhere.
// `verifier` is OAuth's PKCE code verifier, not an email.
const emailFlow = /reset|forgot|verif(?!ier)|confirm|activat|invit|magic|password|passwd|send_?mail|mailer|\bemail|deliver/i;
// Setting the Host of an outgoing request, as Go clients do with `req.Host = ...`, is not reading it.
const assignsHost = /\.Host\s*=(?!=)/;
const contextWindow = 5;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const hostHeaderRule: Rule = {
  id: "host-header",
  description: "Flags links in password reset, verification, and invite emails built from the request's Host header, and host validation turned off.",
  run({ files, config }) {
    if (!config.rules.hostHeader.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const sources = hostSource.filter(({ files: pattern }) => pattern.test(file.path));
      const settings = allowAll.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (sources.length === 0 && settings.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps accept any host on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; kind: Kind }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (settings.some(({ pattern }) => pattern.test(content))) {
          found.push({ line, kind: "allowAll" });
        }
        if (
          sources.some(({ pattern }) => pattern.test(content)) &&
          !assignsHost.test(content) &&
          buildsUrl.test(content) &&
          lines.slice(Math.max(0, index - contextWindow), index + contextWindow + 1).some(({ content: near }) => emailFlow.test(near))
        ) {
          found.push({ line, kind: "link" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      const links = kinds.includes("link");
      return [
        {
          ruleId: "host-header",
          title: "Host header trusted",
          severity: links ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}. ${
            links
              ? "Whoever sends the request chooses that host, so a password reset or invite asked for in a victim's name can mail the victim a link to the attacker's site, carrying the victim's token."
              : "Links and redirects the app builds from the request can then point to any site the client names, and caches can store pages built for that host."
          }`,
          recommendation:
            "Build links in emails from a base URL in the configuration, such as `settings.SITE_URL`, `default_url_options`, or an `APP_URL` environment variable, not from the request. List the app's host names in `ALLOWED_HOSTS` or `config.hosts`, and trust X-Forwarded-Host only from your own proxy."
        }
      ];
    });
  }
};
