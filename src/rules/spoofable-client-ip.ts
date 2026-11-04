import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Setting = {
  files: RegExp;
  pattern: RegExp;
  // Must appear somewhere in the patch, such as the framework the option belongs to.
  context?: RegExp;
  // Must appear in one of the lines just before, such as the YAML key the option sits under.
  under?: RegExp;
};

const code = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|groovy|scala|cs|php)$/i;
const serverConfig = /\.(?:conf|nginx|vhost|ya?ml|j2|jinja2?|tpl|tmpl|template|toml)$|(?:^|\/)(?:nginx[^/]*|httpd[^/]*|apache2?[^/]*|sites-(?:available|enabled)\/[^/]+|conf\.d\/[^/]+|\.htaccess|Dockerfile[^/]*)$/i;
const anyAddress = String.raw`(?:0\.0\.0\.0\/0|::\/0)`;

// The X-Forwarded-For header under the names each platform gives it.
const forwardedFor = /x[-_]forwarded[-_]for/i;
// The first entry of the list, which the client wrote: `split(",")[0]`, `.shift()`, `.first`, and
// PHP's `explode(...)[0]`.
const firstEntry = /\b(?:split|Split|explode|getlist|getHeaders?)\b.*?(?:\[\s*0\s*\]|\.shift\s*\(\s*\)|\.first\b|\.First\s*\(\s*\)|\.at\s*\(\s*0\s*\))/;
// The whole header, with the socket's address only as a fallback when it is missing, as in
// `req.headers["x-forwarded-for"] || req.socket.remoteAddress` or Python's
// `request.headers.get("X-Forwarded-For", request.remote_addr)`.
const socketAddress = String.raw`\b(?:remoteAddress|remote_addr|REMOTE_ADDR|RemoteAddr|getRemoteAddr\s*\(\s*\)|RemoteIpAddress|remote_ip)\b`;
const fallback = new RegExp(String.raw`^x[-_]forwarded[-_]for[^\n]*?(?:\|\||\?\?|\bor\b)[^\n]*?${socketAddress}`, "i");
const getWithDefault = new RegExp(String.raw`\.get\s*\(\s*["']x[-_]forwarded[-_]for["']\s*,\s*[\w.]*${socketAddress}`, "i");

const settings: Setting[] = [
  // Express: `true` trusts every hop, so `req.ip` is the leftmost address, which the client sets.
  { files: code, pattern: /\.set\s*\(\s*["']trust proxy["']\s*,\s*(?:true|["']true["'])\s*\)|\.enable\s*\(\s*["']trust proxy["']\s*\)/ },
  { files: code, pattern: /\btrustProxy\s*:\s*true\b/, context: /\bfastify\b/i },
  // ASP.NET Core's forwarded headers middleware, told to accept them from any address.
  { files: /\.cs$/i, pattern: /\bKnown(?:Networks|Proxies|IPNetworks)\.Clear\s*\(\s*\)/ },
  // Gin trusting every address as a proxy.
  { files: /\.go$/i, pattern: new RegExp(String.raw`\.SetTrustedProxies\s*\(\s*\[\]string\s*\{\s*"${anyAddress}"`) },
  // Tomcat's RemoteIpValve and Spring Boot's settings for it.
  { files: /\.(?:properties|ya?ml|xml)$/i, pattern: /\b(?:internal-?[Pp]roxies|trusted-?[Pp]roxies)["']?\s*[=:]\s*["']?\.\*["']?\s*(?:\/>|$)/ },
  // nginx's realip module and Apache's mod_remoteip trusting every address.
  { files: serverConfig, pattern: new RegExp(String.raw`^\s*set_real_ip_from\s+${anyAddress}\s*;`) },
  { files: serverConfig, pattern: new RegExp(String.raw`^\s*RemoteIP(?:Trusted|Internal)Proxy\s+(?:[^#\n]*\s)?${anyAddress}\b`, "i") },
  // Traefik's entry points, on the command line, in labels, and in its static configuration.
  { files: /\.(?:ya?ml|toml|sh|env)$|(?:^|\/)Dockerfile[^/]*$/i, pattern: /\bforwardedHeaders\.insecure(?:["']?\s*[=:]\s*["']?|=)true\b/ },
  { files: /\.(?:ya?ml|toml)$/i, pattern: /^\s*insecure\s*[:=]\s*true\b/, under: /^\s*\[?[\w.]*forwardedHeaders\]?\s*:?\s*$/ }
];

// Code that reads the header only behind a check that a trusted proxy sent it.
const condition = /\bif\b|\belif\b|\bunless\b|\?|&&|\bwhen\b/;
const trustCheck = /trust|proxy|proxies|behind|isFromProxy|cloudflare|\bcf-connecting-ip\b|\bxForwardedFor\b|\bx_forwarded_for\b|\bxheaders\b/i;
const guardWindow = 2;
// Code that walks the list from the right, skipping trusted proxies, as Tornado's does.
const fromTheRight = /\breversed\s*\(|\.reverse\s*\(|\.pop\s*\(|\.at\s*\(\s*-1\s*\)|\[\s*-1\s*\]|\.last\b|\.Last\s*\(|\btrusted/i;
const rightWindow = 3;
// A header the app sets on a request it forwards, such as `headers["x-forwarded-for"] ??= ...`.
const setsHeader = /x[-_]forwarded[-_]for["'`]\s*\]\s*(?:\?\?|\|\|)?=(?!=)/i;
const underWindow = 3;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const spoofableClientIpRule: Rule = {
  id: "spoofable-client-ip",
  description: "Flags client addresses taken from X-Forwarded-For without checking which proxy sent it, and proxies trusted from any address.",
  run({ files, config }) {
    if (!config.rules.spoofableClientIp.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const readsHeader = code.test(file.path);
      if (
        (fileSettings.length === 0 && !readsHeader) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test setups run without a proxy in front.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const found: number[] = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const setting = active.some(
          ({ pattern, under }) =>
            pattern.test(content) && (under === undefined || lines.slice(Math.max(0, index - underWindow), index).some(({ content: before }) => under.test(before)))
        );
        const header =
          readsHeader &&
          forwardedFor.test(content) &&
          !setsHeader.test(content) &&
          (firstEntry.test(content) || fallback.test(content.slice(content.search(forwardedFor))) || getWithDefault.test(content)) &&
          !lines.slice(index + 1, index + rightWindow + 1).some(({ content: after }) => fromTheRight.test(after));
        if (!setting && !header) {
          return;
        }
        // In code, an option the app's operator sets, such as `if (config.trustProxy)`, decides.
        if (readsHeader && guarded(lines, index)) {
          return;
        }
        found.push(line);
      });
      if (found.length === 0) {
        return [];
      }

      const { text: where, plural } = describeLines(found);
      return [
        {
          ruleId: "spoofable-client-ip",
          title: "Client IP can be spoofed",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${where} ${plural ? "take" : "takes"} the client's address from X-Forwarded-For without checking which proxy added it, so a client can send any address it likes and get around IP allowlists, rate limits, and lockouts, or hide its own address in the logs.`,
          recommendation:
            "Trust only the proxies in front of the app: set Express's `trust proxy` to the number of hops or their addresses, list them in `KnownProxies`, `set_real_ip_from`, `RemoteIPTrustedProxy`, or Tomcat's `internal-proxies`, and take the address the last trusted proxy added, which is the rightmost untrusted entry, not the first."
        }
      ];
    });
  }
};

// Whether a check of a proxy option or a trusted proxy guards the line: on it, in the lines just
// before, or opening its block, as in `if (config.get("trust proxy")) { ... } else { ... }`.
function guarded(lines: Array<{ content: string }>, index: number): boolean {
  // The line's own strings, such as 'trust proxy' in `app.set('trust proxy', true)`, are not a check.
  const own = (lines[index]?.content ?? "").replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "");
  const before = lines.slice(Math.max(0, index - guardWindow), index).map(({ content }) => content);
  return [own, ...before, ...enclosingBlocks(lines, index)].some((content) => condition.test(content) && trustCheck.test(content) && !forwardedFor.test(content));
}

// Every line before that opens a block this line is in, from the nearest outward.
function enclosingBlocks(lines: Array<{ content: string }>, index: number): string[] {
  const blocks: string[] = [];
  let indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - 30) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      blocks.push(content);
      indent = start;
      // An `else` block is guarded by the `if` it belongs to, at the same indent above it.
      if (/\belse\b/.test(content)) {
        const opening = lines.slice(Math.max(0, before - 30), before).reverse().find(({ content: other }) => other.search(/\S/) === start && /\bif\b/.test(other));
        if (opening !== undefined) {
          blocks.push(opening.content);
        }
      }
    }
  }
  return blocks;
}
