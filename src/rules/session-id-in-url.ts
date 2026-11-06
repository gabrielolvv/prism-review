import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; files: RegExp; pattern: RegExp; under?: RegExp };

const springSettings = /(?:^|\/)(?:application|bootstrap)[^/]*\.(?:properties|ya?ml)$/i;

const settings: Setting[] = [
  // Spring Boot's session tracking modes, with `url` among them.
  { label: "Spring Boot", files: springSettings, pattern: /\bserver\.servlet\.session\.tracking-modes\s*[=:]\s*[^#\n]*\burl\b/i },
  { label: "Spring Boot", files: springSettings, pattern: /^\s*tracking-modes\s*:\s*[^#\n]*\burl\b/i },
  { label: "Spring Boot", files: springSettings, pattern: /^\s*-\s*["']?url["']?\s*$/i, under: /^\s*tracking-modes\s*:\s*$/ },
  // The Servlet API's URL tracking mode, in web.xml and in code.
  { label: "the Servlet API", files: /(?:^|\/)web(?:-fragment)?\.xml$/i, pattern: /<tracking-mode>\s*URL\s*<\/tracking-mode>/i },
  { label: "the Servlet API", files: /\.(?:java|kt|groovy|scala)$/i, pattern: /\bsetSessionTrackingModes\s*\([^)]*\bSessionTrackingMode\.URL\b/ },
  // Apache Shiro's URL rewriting of the session ID.
  { label: "Apache Shiro", files: /\.(?:ini|java|kt|groovy|properties|ya?ml|xml)$/i, pattern: /\bsessionIdUrlRewritingEnabled\s*=\s*true\b|\bsetSessionIdUrlRewritingEnabled\s*\(\s*true\s*\)|\bshiro\.sessionManager\.sessionIdUrlRewritingEnabled\s*[=:]\s*true\b/ },
  // PHP's transparent session IDs, and sessions taken from the URL.
  {
    label: "PHP",
    files: /(?:^|\/)(?:php[^/]*\.ini|\.user\.ini|\.htaccess)$|\.(?:php|conf|ini|sh|ya?ml)$|(?:^|\/)Dockerfile[^/]*$/i,
    pattern: /\bsession\.use_trans_sid["']?\s*(?:=|,|\s)\s*["']?(?:1|on|true)\b|\bsession\.use_only_cookies["']?\s*(?:=|,|\s)\s*["']?(?:0|off|false)\b/i
  },
  // ASP.NET's cookieless sessions and forms authentication.
  { label: "ASP.NET", files: /(?:^|\/)web(?:\.[\w-]+)?\.config$/i, pattern: /<(?:sessionState|forms)\b[^>]*\bcookieless\s*=\s*["'](?:true|UseUri|AutoDetect|UseDeviceProfile)["']/i },
  // Rack and Rails sessions that also accept the ID from request parameters.
  { label: "Rack or Rails", files: /\.(?:rb|ru)$/i, pattern: /\bcookie_only\s*(?::|=>)\s*false\b/ }
];
const underWindow = 3;

const commentLine = /^\s*(?:#|\/\/|;|<!--|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const sessionIdInUrlRule: Rule = {
  id: "session-id-in-url",
  description: "Flags web apps set to carry the session ID in URLs, such as Spring Boot's `url` tracking mode, PHP's `session.use_trans_sid`, and ASP.NET's cookieless sessions.",
  run({ files, config }) {
    if (!config.rules.sessionIdInUrl.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test settings.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; label: string }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const setting = fileSettings.find(
          ({ pattern, under }) =>
            pattern.test(content) && (under === undefined || lines.slice(Math.max(0, index - underWindow), index).some(({ content: before }) => under.test(before)))
        );
        if (setting !== undefined) {
          found.push({ line, label: setting.label });
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
          ruleId: "session-id-in-url",
          title: "Session ID carried in URLs",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} ${listOf(labels)} carry the session ID in URLs, where it ends up in server and proxy logs, browser history, and the Referer header sent to other sites, so anyone who sees one of those can take over the session, and an attacker can send a link that fixes a victim's session to an ID they know.`,
          recommendation:
            "Track sessions with cookies only: Spring Boot's `tracking-modes=cookie`, `<tracking-mode>COOKIE</tracking-mode>`, Shiro's `sessionIdUrlRewritingEnabled = false`, PHP's `session.use_trans_sid=0` and `session.use_only_cookies=1`, ASP.NET's `cookieless=\"UseCookies\"`, and Rack's default `cookie_only: true`. Mark the cookie `HttpOnly`, `Secure`, and `SameSite`."
        }
      ];
    });
  }
};
