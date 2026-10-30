import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { requestValue } from "./untrusted-input.js";

type Language = {
  files: RegExp;
  // Calls and statements that write the response body, in order of preference: the text after the
  // first one that matches is checked for a request value.
  sinks: RegExp[];
  // Request values this rule reads beyond untrusted-input's.
  request?: RegExp;
  guard: RegExp;
};

// Text that looks like HTML, for sinks that only send HTML when the text is HTML, such as Koa's
// `ctx.body`, or a Flask `return` outside a route.
const htmlText = /["'`][^"'`]*<\/?[a-zA-Z][\w-]*[\s>/]/;
// Templates escape the values they are given, as in `Response(render_template("page.html", q=q))`.
const rendered = /^\s*(?:[\w$.]+\.)?(?:render\w*|\w*[tT]emplate\w*|renderToString)\s*\(/;
// Responses that are not HTML.
const notHtml = /\b(?:application\/json|text\/plain|text\/csv|application\/octet-stream)\b|\bmimetype\s*=\s*["'](?!text\/html)|\bcontent_type\s*=\s*["'](?!text\/html)|\.type\s*\(\s*["'](?:json|text|txt|plain)["']\s*\)/;

const languages: Language[] = [
  {
    // Express sends text as HTML. `res.json` and `res.jsonp` escape nothing but are not HTML.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    sinks: [/\b(?:res|response)\.(?:send|write|end)\s*\(/],
    guard: /\bescape\w*\s*\(|\bencode(?:HTML|Html|ForHTML)\w*\s*\(|\bDOMPurify\.sanitize\s*\(|\bsanitize\w*\s*\(|\bxss\s*\(|\bhe\.(?:encode|escape)\s*\(|\b(?:Number|parseInt|parseFloat)\s*\(/
  },
  {
    // Flask and Django. A Flask view's returned text is an HTML response.
    files: /\.py$/i,
    sinks: [/\b(?:HttpResponse|make_response|Response)\s*\(/, /^\s*return\s+/],
    guard: /\bescape\s*\(|\bhtml\.escape\s*\(|\bmarkupsafe\.escape\s*\(|\bconditional_escape\s*\(|\bbleach\.clean\s*\(|\bnh3\.clean\s*\(|\bjsonify\s*\(|\bJsonResponse\s*\(|\b(?:int|float)\s*\(/
  },
  {
    files: /\.php$/i,
    sinks: [/(?:^\s*|<\?php\s+|;\s*)(?:echo|print)\b|<\?=|\bprintf\s*\(/],
    request: /\$_SERVER\s*\[\s*["'](?:PHP_SELF|REQUEST_URI|QUERY_STRING|HTTP_REFERER|HTTP_USER_AGENT)["']\s*\]/,
    guard: /\bhtmlspecialchars\s*\(|\bhtmlentities\s*\(|\bstrip_tags\s*\(|\besc_html\s*\(|\besc_attr\s*\(|\be\s*\(|\bintval\s*\(|\(int\)|\bjson_encode\s*\(/
  },
  {
    // net/http. The body's type is sniffed, so text that starts with `<` is served as HTML.
    files: /\.go$/i,
    sinks: [/\bfmt\.Fprint(?:f|ln)?\s*\(\s*w\s*,|\bw\.Write\s*\(|\bio\.WriteString\s*\(\s*w\s*,/],
    guard: /\bhtml\.EscapeString\s*\(|\btemplate\.HTMLEscape(?:String|r)?\s*\(|\bstrconv\.\w+\s*\(/
  },
  {
    // Servlets and JSP scriptlets.
    files: /\.(?:java|kt|jsp)$/i,
    sinks: [/\.getWriter\s*\(\s*\)\s*\.(?:print|println|write|append|printf)\s*\(|\bout\.(?:print|println|write)\s*\(/],
    request: /\b(?:request|req)\.get(?:Parameter|Header|QueryString|RequestURI)\s*\(/,
    guard: /\bescapeHtml\d?\s*\(|\bEncode\.forHtml\w*\s*\(|\bencodeForHTML\w*\s*\(|\bHtmlUtils\.htmlEscape\s*\(|\bInteger\.parseInt\s*\(/
  },
  {
    // ASP.NET and ASP.NET Core.
    files: /\.(?:cs|aspx|cshtml)$/i,
    sinks: [/\bResponse\.(?:Write|WriteAsync)\s*\(|\bContent\s*\([^)]*["']text\/html["']/],
    request: /\bRequest\.(?:QueryString|Params)\s*\[/,
    guard: /\bHtmlEncode\s*\(|\bHtmlEncoder\.\w+\.Encode\s*\(|\bAntiXssEncoder\.\w+\s*\(|\bint\.Parse\s*\(/
  }
];

// A Flask route, so a bare `return` in the function below it is the response.
const flaskRoute = /^\s*@\w+\.(?:route|get|post|put|patch|delete)\s*\(/;
const pythonDef = /^\s*(?:async\s+)?def\s+\w+\s*\(/;
const assignment = /^\s*(?:(?:const|let|var|final|String|string|\$)?\s*)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
const reach = 20;
// Text built from pieces, which carries a request value along: concatenation, f-strings, templates,
// `%`, and `.format()`.
const builtText = /["'`]\s*(?:\+|\.|%)|(?:\+|\.)\s*["'`]|\b[fF]["']|`[^`]*\$\{|["']\.format\s*\(/;
// The start of a value: a name or a chain of members, indexes, and calls on it.
const leadingChain = /^\s*(?:await\s+)?\$?([\w$]+(?:\??\.[\w$]+|\[[^\]]*\]|\([^()]*\))*)/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const reflectedXssRule: Rule = {
  id: "reflected-xss",
  description: "Flags request values written straight into an HTML response.",
  run({ files, config }) {
    if (!config.rules.reflectedXss.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (
        language === undefined ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = findReflections(file.patch, language);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "reflected-xss",
          title: "Request value written into an HTML response",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write values" : "writes a value"} from the request straight into an HTML response, so a link with \`<script>\` in it runs that script for whoever opens it (reflected cross-site scripting).`,
          recommendation:
            "Render the response with a template that escapes values, or escape the value for HTML first, such as with `html.escape`, `htmlspecialchars`, `html.EscapeString`, `Encode.forHtml`, or `HtmlEncoder.Default.Encode`. Send data as JSON or plain text when it is not meant to be HTML."
        }
      ];
    });
  }
};

function findReflections(patch: string, language: Language): number[] {
  const fromRequest = (text: string) => requestValue.test(text) || (language.request?.test(text) ?? false);
  const tainted = new Map<string, number>();
  const found: number[] = [];
  // Python: whether the current function is a Flask route.
  let inRoute = false;
  let routeNext = false;

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    if (flaskRoute.test(content)) {
      routeNext = true;
    } else if (pythonDef.test(content)) {
      inRoute = routeNext;
      routeNext = false;
    }

    const isTainted = (text: string) =>
      fromRequest(text) ||
      [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text));

    const sink = language.sinks.map((pattern) => pattern.exec(content)).find((match) => match !== null) ?? null;
    if (added && sink !== null && !language.guard.test(content) && !notHtml.test(content)) {
      const written = content.slice(sink.index + sink[0].length);
      // A Python `return` is a response only in a route, or when it returns HTML text. Flask sends a
      // returned dict or list as JSON.
      const isReturn = /^\s*return\b/.test(sink[0]);
      const isResponse = !isReturn || ((inRoute || htmlText.test(written)) && !/^\s*[{[]/.test(written));
      if (isResponse && !rendered.test(written) && isTainted(written)) {
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
    // A name holds a request value when it is assigned one, or text built from one. The result of a
    // call that receives a request value, such as `serializer = get_serializer(data=request.data)`,
    // is something else.
    const assigned = assignment.exec(content);
    if (assigned?.[1] !== undefined) {
      const value = assigned[2] ?? "";
      const lead = leadingChain.exec(value)?.[1] ?? "";
      // The value starts with the request, as in `request.args.get("name")`, or with a name that holds it.
      const startsWithRequest = [requestValue, language.request].some((pattern) => pattern?.exec(lead)?.index === 0);
      const firstName = /^[\w$]+/.exec(lead)?.[0] ?? "";
      const direct = startsWithRequest || (tainted.has(firstName) && line - (tainted.get(firstName) ?? 0) <= reach);
      if (!language.guard.test(value) && (direct || (builtText.test(value) && isTainted(value)))) {
        tainted.set(assigned[1], line);
      } else {
        tainted.delete(assigned[1]);
      }
    }
  }
  return found;
}
