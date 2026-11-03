import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// Settings that show stack traces and exception details to whoever triggers an error. `context`,
// when given, must appear somewhere in the patch.
const settings: Array<{ files: RegExp; pattern: RegExp; context?: RegExp }> = [
  // PHP's display_errors in php.ini, .user.ini, .htaccess, and PHP-FPM pools.
  {
    files: /\.(?:ini|conf|htaccess)$|(?:^|\/)php\.ini[^/]*$/i,
    pattern:
      /^\s*display_errors\s*=\s*["']?(?:On|1|true|yes|stdout)\b|\bphp_(?:admin_)?(?:flag|value)\s+display_errors\s+["']?(?:on|1|true)\b|\bphp_(?:admin_)?(?:flag|value)\[display_errors\]\s*=\s*["']?(?:on|1|true)\b/i
  },
  // ...and turned on from code.
  { files: /\.php$/i, pattern: /\bini_set\s*\(\s*["']display_errors["']\s*,\s*(?:["'](?:1|on|true|stdout)["']|1|true)\s*\)/i },
  // Spring Boot's error response with the stack trace or the exception's class.
  {
    files: /(?:^|\/)(?:application|bootstrap)[^/]*\.(?:properties|ya?ml)$/i,
    pattern: /\binclude-stacktrace\s*[=:]\s*["']?(?:always|on[-_]param|on[-_]trace[-_]param)\b|\binclude-exception\s*[=:]\s*["']?true\b/i
  },
  // ASP.NET's and IIS's detailed error pages, and WCF faults with exception details, in web.config.
  {
    files: /\.config$/i,
    pattern: /<customErrors\b[^>]*\bmode\s*=\s*["']Off["']|<httpErrors\b[^>]*\berrorMode\s*=\s*["']Detailed["']|\bincludeExceptionDetailInFaults\s*=\s*["']true["']/i
  },
  // ...and in code: WCF, Hot Chocolate, gRPC and SignalR, and Blazor Server's circuits.
  { files: /\.cs$/i, pattern: /\b(?:IncludeExceptionDetailInFaults|IncludeExceptionDetails|EnableDetailedErrors|DetailedErrors)\s*=\s*true\b/ },
  { files: /(?:^|\/)appsettings[^/]*\.json$/i, pattern: /["']DetailedErrors["']\s*:\s*true\b/ },
  // Apollo Server's stack traces in error responses, and Apollo Server 3's and NestJS's debug option.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\bincludeStacktraceInErrorResponses\s*:\s*true\b/ },
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /^\s*debug\s*:\s*true\b/, context: /\b(?:ApolloServer|GraphQLModule|ApolloDriver)\b/ },
  // GraphQL Yoga shows every error's message, such as a database error, when masking is off.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\bmaskedErrors\s*:\s*false\b/, context: /\bcreateYoga\b|graphql-yoga/ }
];

// Stack traces put into a response. `stack` finds the trace and `respond` the response it goes in,
// on the same line, or a few lines before when the trace is a field of the response's object.
const responses: Array<{ files: RegExp; stack: RegExp; respond: RegExp; field: RegExp }> = [
  // Express, Koa, Fastify, Hono, Next.js, and the Fetch API's Response.
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    stack: /\b(?:err|error|e|ex|exc|exception|reason)\.stack\b/,
    respond:
      /\b(?:res|reply|ctx|response|resp)\.(?:status\s*\([^)]*\)\s*\.)?(?:send|json|end|write)\s*\(|\bctx\.body\s*=|\bnew\s+Response\s*\(|\b(?:Next)?Response\.json\s*\(|\bc\.(?:json|text)\s*\(/,
    field: /^\s*(?:["']?\w+["']?\s*:\s*)?(?:err|error|e|ex|exc|exception|reason)\.stack\b/
  },
  // A formatted traceback in a Flask, Django, FastAPI, aiohttp, or Tornado response.
  {
    files: /\.py$/i,
    stack: /\btraceback\.format_(?:exc|exception|tb)\s*\(/,
    respond:
      /\bjsonify\s*\(|\b(?:Http|JSON|PlainText|HTML|Streaming)?Response\s*\(|\bmake_response\s*\(|\babort\s*\(|\bself\.(?:write|finish)\s*\(|\bweb\.(?:json_)?[Rr]esponse\s*\(|\bHTTPException\s*\(|\breturn\s*\{|\breturn\b.*,\s*[45]\d\d\s*$/,
    field: /^\s*(?:["']\w+["']\s*:|(?:detail|content|body|text|data)\s*=)\s*traceback\.format_/
  },
  // A servlet's or JSP's stack trace printed to the response, and Commons Lang's or Guava's
  // formatted trace in a ResponseEntity or a JAX-RS Response.
  {
    files: /\.(?:java|kt|groovy|scala|jsp)$/i,
    stack: /\.printStackTrace\s*\(\s*(?:new\s+(?:java\.io\.)?PrintWriter\s*\(\s*)?(?:(?:response|resp|res|httpResponse|servletResponse)\.(?:getWriter|getOutputStream)\s*\(\s*\)|out\s*\))|\b(?:ExceptionUtils\.getStackTrace|Throwables\.getStackTraceAsString)\s*\(/,
    respond: /\.printStackTrace\s*\(|\bResponseEntity\b|\.body\s*\(|\.entity\s*\(|\bgetWriter\s*\(\s*\)/,
    field: /^\s*\.?(?:body|entity)\s*\(\s*(?:ExceptionUtils\.getStackTrace|Throwables\.getStackTraceAsString)\s*\(/
  },
  // Go's debug.Stack() written to the response.
  {
    files: /\.go$/i,
    stack: /\bdebug\.Stack\s*\(\s*\)/,
    respond: /\bhttp\.Error\s*\(|\b(?:w|rw|writer|resp)\.Write\s*\(|\bfmt\.Fprint\w*\s*\(\s*(?:w|rw|writer)\s*,|\bc\.(?:JSON|String|Data|Blob|HTML|IndentedJSON)\s*\(/,
    field: /^\s*["']?\w+["']?\s*:\s*string\s*\(\s*debug\.Stack\s*\(/
  },
  // Rails, Sinatra, and Grape responses with the exception's backtrace.
  {
    files: /\.rb$/i,
    stack: /\b\w+\.backtrace\b/,
    respond: /\brender\b|\bhalt\b|\berror!\s*[\s(]|\bjson\s*\(|\bbody\s*\(/,
    field: /^\s*(?:["']?\w+["']?\s*(?::|=>)\s*)\w+\.backtrace\b/
  },
  // PHP responses with the exception's trace.
  {
    files: /\.php$/i,
    stack: /->getTrace(?:AsString)?\s*\(\s*\)/,
    respond: /\becho\b|\bprint\b|\bjson_encode\s*\(|\bresponse\s*\(\s*\)\s*->\s*json\s*\(|\bJsonResponse\s*\(|\bdie\s*\(|\bexit\s*\(|\breturn\s*\[/,
    field: /^\s*["']\w+["']\s*=>\s*\$\w+->getTrace(?:AsString)?\s*\(/
  },
  // ASP.NET responses with the exception's stack trace or its ToString(), which includes it.
  {
    files: /\.cs$/i,
    stack: /\b\w+\.StackTrace\b|\b(?:e|ex|exc|exception|err|error)\.ToString\s*\(\s*\)/,
    respond:
      /\b(?:Ok|BadRequest|StatusCode|Problem|Content|Json|ObjectResult|NotFound|UnprocessableEntity)\s*\(|\bWrite(?:AsJson)?Async\s*\(|\b(?:Typed)?Results\.\w+\s*\(|\bnew\s+(?:ObjectResult|JsonResult|ContentResult)\b/,
    field: /^\s*(?:\w+\s*=\s*)?\w+\.StackTrace\b/
  }
];
const responseWindow = 4;

// Code that sends details only in development, behind an environment check, keeps them from
// production. The check may be on the line, just before it, or on a line that opens its block.
const condition = /\bif\b|\belif\b|\bunless\b|\bwhen\b|\?|&&|#if\b|\bcase\b|\bswitch\b/;
const environment =
  /NODE_ENV|\bENV\b|environment|isDev|IsDevelopment|__DEV__|debug|development|\bdev\b|isProd|IsProduction|production|\bprod\b|Rails\.env|RAILS_ENV|APP_ENV|FLASK_ENV|\bis_?local\b|IsLocal/i;
const guardWindow = 2;
const blockWindow = 30;

// Debug configurations, such as web.Debug.config, and debug pages, such as Rails' debug_exceptions.rb.
const debugPath = /(?:^|[\/_.-])debug(?:[\/_.-]|$)/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--|<%--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const errorDetailsRule: Rule = {
  id: "error-details",
  description: "Flags stack traces and exception details sent to clients, and error pages set to show them outside development.",
  run({ files, config }) {
    if (!config.rules.errorDetails.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const fileResponses = responses.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (fileSettings.length === 0 && fileResponses.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test setups show details on purpose.
        developmentPath.test(file.path) ||
        debugPath.test(file.path) ||
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
        const setting = active.some(({ pattern }) => pattern.test(content));
        const response = fileResponses.some(({ stack, respond, field }) => {
          const match = stack.exec(content);
          if (match === null || insideString(content, match.index)) {
            return false;
          }
          return (
            respond.test(content) ||
            (field.test(content) && lines.slice(Math.max(0, index - responseWindow), index).some(({ content: before }) => respond.test(before)))
          );
        });
        if ((!setting && !response) || guarded(lines, index)) {
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
          ruleId: "error-details",
          title: "Error details sent to clients",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${where} ${plural ? "send" : "sends"} stack traces or exception details to clients, which show whoever triggers an error file paths, library versions, queries, and sometimes secrets, and help them aim the next request.`,
          recommendation:
            "Log the full error on the server with an ID, and send clients a generic message with that ID. Show details only in development, behind an environment check, and keep production settings such as `display_errors = Off`, `server.error.include-stacktrace=never`, `customErrors mode=\"RemoteOnly\"`, and Apollo's `includeStacktraceInErrorResponses: false`."
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

// Whether the text before `index` leaves a quote open.
function insideString(content: string, index: number): boolean {
  const before = content.slice(0, index).replace(/\\./g, "");
  return ["'", '"', "`"].some((quote) => (before.split(quote).length - 1) % 2 === 1);
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
