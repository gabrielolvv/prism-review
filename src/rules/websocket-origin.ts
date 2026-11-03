import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// Settings that accept a WebSocket handshake from any origin.
const settings: Array<{ files: RegExp; pattern: RegExp; context?: RegExp }> = [
  // Spring's WebSocket and STOMP endpoints.
  {
    files: /\.(?:java|kt)$/i,
    pattern: /\.setAllowedOrigin(?:Pattern)?s\s*\(\s*"\*"\s*\)/,
    context: /\bWebSocket|\bStomp|\bSockJS|registerStompEndpoints|registerWebSocketHandlers/
  },
  // Jakarta and Java EE endpoint configurators.
  { files: /\.(?:java|kt)$/i, pattern: /\bboolean\s+checkOrigin\s*\(\s*String\s+\w+\s*\)\s*\{\s*return\s+true\s*;/ },
  // ws: verifyClient that accepts every client.
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    pattern: /\bverifyClient\s*:\s*(?:\(\s*[^)]*\)|\w+)\s*=>\s*(?:true\b|\{\s*return\s+true\s*;?\s*\}|\w+\s*\(\s*true\s*\))/
  },
  // coder/websocket and nhooyr.io/websocket.
  { files: /\.go$/i, pattern: /\bInsecureSkipVerify\s*:\s*true\b|\bOriginPatterns\s*:\s*\[\]string\s*\{\s*"\*"\s*\}/, context: /websocket/ },
  // Rails ActionCable.
  {
    files: /(?:^|\/)config\/(?:application|environments\/[^/]+|cable)\.rb$/i,
    pattern: /\baction_cable\.disable_request_forgery_protection\s*=\s*true\b|\bdisable_request_forgery_protection\s*=\s*true\b|\ballowed_request_origins\s*=\s*\[?\s*\/\.\*\//
  },
  // Phoenix sockets and endpoints.
  { files: /\.exs?$/i, pattern: /\bcheck_origin\s*:\s*false\b/ },
  // ASP.NET Core's WebSocketOptions.
  { files: /\.cs$/i, pattern: /\bAllowedOrigins\s*\.\s*Add\s*\(\s*"\*"\s*\)|\bAllowedOrigins\s*=\s*\{\s*"\*"\s*\}/ }
];

// gorilla/websocket's CheckOrigin set to a function that returns true, on one line or with the
// return on the next lines.
const checkOriginFunction = /\bCheckOrigin\s*[:=]\s*func\s*\(\s*\w*\s*\*?http\.Request\s*\)\s*bool\s*\{\s*(?:return\s+true\b)?/;
const returnsTrue = /^\s*return\s+true\s*$/;
const goComment = /^\s*\/\//;

// Django Channels: cookie sessions on the websocket route with no origin validator in the file.
const channelsRoute = /["']websocket["']\s*:\s*(?:\w+\()?\s*(?:AuthMiddlewareStack|SessionMiddlewareStack|CookieMiddleware)\b/;
const channelsValidator = /\b(?:AllowedHostsOriginValidator|OriginValidator)\b/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const websocketOriginRule: Rule = {
  id: "websocket-origin",
  description: "Flags WebSocket servers that accept connections from any origin, which lets other sites use a signed-in user's session.",
  run({ files, config }) {
    if (!config.rules.websocketOrigin.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const go = /\.go$/i.test(file.path);
      const python = /\.py$/i.test(file.path);
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (fileSettings.length === 0 && !go && !python) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps accept any origin on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const validated = python && channelsValidator.test(text);
      const found: number[] = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (active.some(({ pattern }) => pattern.test(content))) {
          found.push(line);
        }
        if (go && acceptsEveryOrigin(lines, index)) {
          found.push(line);
        }
        if (python && !validated && channelsRoute.test(content)) {
          found.push(line);
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found)];
      const { text: where, plural } = describeLines(reported);
      return [
        {
          ruleId: "websocket-origin",
          title: "WebSocket accepts any origin",
          severity: "warning" as const,
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${where} ${plural ? "let" : "lets"} a WebSocket accept connections from any origin. Browsers send cookies with the handshake and CORS does not apply, so any site a signed-in user visits can open the socket as that user and read what it sends.`,
          recommendation:
            "Check the Origin header against the app's own origins: keep gorilla's default CheckOrigin or compare the origin to a list, list origins in Spring's `setAllowedOrigins`, wrap Django Channels routes in `AllowedHostsOriginValidator`, set ActionCable's `allowed_request_origins`, and leave Phoenix's `check_origin` on. Authenticating sockets with a token instead of cookies also prevents this."
        }
      ];
    });
  }
};

// gorilla's CheckOrigin set to a function whose first statement returns true.
function acceptsEveryOrigin(lines: Array<{ content: string }>, index: number): boolean {
  const content = lines[index]?.content ?? "";
  const match = checkOriginFunction.exec(content);
  if (match === null) {
    return false;
  }
  if (/return\s+true\b/.test(match[0])) {
    return true;
  }
  for (const { content: next } of lines.slice(index + 1, index + 4)) {
    if (next.trim() === "" || goComment.test(next)) {
      continue;
    }
    return returnsTrue.test(next);
  }
  return false;
}
