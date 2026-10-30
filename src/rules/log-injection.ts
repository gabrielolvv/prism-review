import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { codeOutsideText, logCall } from "../security/secret-logs.js";
import { describeLines } from "./line-list.js";
import { railsParams } from "./untrusted-input.js";

// Request values that can hold a line break once decoded: query strings, bodies, forms, and cookies.
// A request's URL and header values cannot hold a raw line break, so `req.url`, `req.headers`,
// `request.META`, and `getHeader` are left out, and route parameters are usually IDs the router matched.
const requestValue =
  /\b(?:req|request|ctx(?:\.request)?)\.(?:query|body|cookies)\b|\brequest\.(?:args|form|values|json|get_json\(|GET|POST|COOKIES|data|query_params)\b|\$_(?:GET|POST|REQUEST|COOKIE)\b|\br\.(?:URL\.Query\(\)|FormValue\(|PostFormValue\()|\bRequest\.(?:Query|Form|Cookies)\[|\bsearchParams\.get\(/;
// A whole request object, such as `console.log(req.query)`, is written with `util.inspect` or `repr`,
// which shows a line break inside a value as `\n`.
const wholeObject =
  /\b(?:req|request|ctx(?:\.request)?)\.(?:query|params|body|cookies|args|form|values|json|data|GET|POST|COOKIES|query_params)\b(?!\s*(?:\.|\[|\?\.|\())/g;
const servletValue = /\b(?:request|req)\.getParameter(?:Values)?\s*\(/;
// Values cleaned of line breaks or quoted: `.replace(/[\r\n]/g, "")`, `repr()`, `%r`, `!r`, Go's `%q`,
// `JSON.stringify`, `json.dumps`, and escaping helpers.
const cleaned =
  /\.replace(?:All)?\s*\(\s*(?:\/[^/]*\\[rn][^/]*\/[gimsuy]*|["'][^"']*\\[rn][^"']*["'])|\brepr\s*\(|%r\b|!r\}|%q\b|\bJSON\.stringify\s*\(|\bjson\.dumps\s*\(|\bstrconv\.Quote\s*\(|\b(?:sanitize|escape|encode|clean|strip)\w*\s*\(|\bStringEscapeUtils\.escape\w+\s*\(|\bEncode\.for\w+\s*\(|\.inspect\b|\bp\s*\(/i;
// Structured fields, which JSON loggers write with line breaks escaped: an object as the first
// argument, as in pino's `logger.info({ q: req.query.q }, "search")`, or keyword fields in structlog.
const structuredFirst = /^\s*\{/;
const assignment = /^\s*(?:(?:const|let|var|final|String|string)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
const reach = 20;

const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const maxLineLength = 1_000;

export const logInjectionRule: Rule = {
  id: "log-injection",
  description: "Flags request values written into the text of a log line without removing line breaks.",
  run({ files, config }) {
    if (!config.rules.logInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !sourceFile.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = findInjectedLogs(file.path, file.patch);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "log-injection",
          title: "Request value written into a log line",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} from the request into the text of a log line, so a value with a line break in it can add fake entries, such as a forged login, to the log.`,
          recommendation:
            "Remove line breaks first, such as `value.replace(/[\\r\\n]/g, \"\")`, log a quoted form such as `%r` in Python or `%q` in Go, or use a structured logger that writes fields as JSON, such as pino, structlog, or Logback's JSON encoder, and pass the value as a field."
        }
      ];
    });
  }
};

function findInjectedLogs(path: string, patch: string): number[] {
  const ruby = /\.(?:rb|erb|rake)$/i.test(path);
  const java = /\.(?:java|kt|scala)$/i.test(path);
  const fromRequest = (text: string) => requestValue.test(text) || (ruby && railsParams.test(text)) || (java && servletValue.test(text));
  const tainted = new Map<string, number>();
  const found: number[] = [];

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const isTainted = (text: string) =>
      fromRequest(text) ||
      [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.:])\\$?${name}(?![\\w$])`).test(text));

    const call = logCall.exec(content);
    if (added && call !== null && !cleaned.test(content)) {
      // Names are looked for in the code, with the text of strings removed but the values they insert kept.
      const args = codeOutsideText(content.slice(call.index + call[0].length)).replace(wholeObject, "");
      if (!structuredFirst.test(args) && isTainted(args)) {
        found.push(line);
      }
    }

    const names = destructuring.exec(content);
    if (names !== null && fromRequest(names[2] ?? "")) {
      for (const part of (names[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== undefined) {
          tainted.set(name, line);
        }
      }
    }
    // A name holds a request value when the value starts with one, as in
    // `username = request.form["username"]`; a call that receives one returns something else.
    const assigned = assignment.exec(content);
    if (assigned?.[1] !== undefined) {
      const value = (assigned[2] ?? "").replace(/^\s*await\s+/, "");
      const starts = [requestValue, ruby ? railsParams : undefined, java ? servletValue : undefined].some(
        (pattern) => pattern?.exec(value)?.index === 0
      );
      if (starts && !cleaned.test(value)) {
        tainted.set(assigned[1], line);
      } else {
        tainted.delete(assigned[1]);
      }
    }
  }
  return found;
}
