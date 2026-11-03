import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// A size written as text, as body-parser takes it: "1gb", "500mb", or "100 MB".
const sizeText = /["'`](\d+(?:\.\d+)?)\s*(gb|mb|g|m)["'`]/i;
// Limits from 100 MB up, the point where a parser that reads the whole body into memory, as JSON and
// form parsers do, can be made to hold or parse more than a server can spare.
const largeMegabytes = 100;

// Parsers that read the whole body into memory: body-parser's and Express's json, urlencoded, and text,
// and koa-body's and koa-bodyparser's json, form, and text limits.
const parserLimit = /\b(?:bodyParser|express)\.(?:json|urlencoded|text)\s*\(\s*\{[^}]*\blimit\s*:\s*([^,}]+)|\b(?:jsonLimit|formLimit|textLimit)\s*:\s*([^,}]+)/;
// Fastify's bodyLimit in bytes.
const fastifyLimit = /\bbodyLimit\s*:\s*([^,}]+)/;
const unlimitedValue = /^\s*(?:Infinity|Number\.(?:MAX_SAFE_INTEGER|MAX_VALUE|POSITIVE_INFINITY))\b/;

// Settings that turn a limit off.
const turnedOff: Array<{ files: RegExp; pattern: RegExp }> = [
  // Multer's and busboy's fileSize, and formidable's maxFileSize, set to Infinity.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\b(?:fileSize|maxFileSize|maxTotalFileSize|maxFieldsSize)\s*:\s*(?:Infinity|Number\.(?:MAX_SAFE_INTEGER|MAX_VALUE|POSITIVE_INFINITY))\b/ },
  // nginx's client_max_body_size 0 turns the check off.
  { files: /\.conf$|(?:^|\/)nginx[^/]*$/i, pattern: /^\s*client_max_body_size\s+0\s*;/ },
  // Django's upload limits set to None.
  { files: /\.py$/i, pattern: /^\s*DATA_UPLOAD_MAX_(?:MEMORY_SIZE|NUMBER_FIELDS|NUMBER_FILES)\s*=\s*None\b/ },
  // Spring Boot's multipart and form limits set to -1.
  {
    files: /\.(?:properties|ya?ml)$/i,
    pattern: /\b(?:spring\.servlet\.multipart\.max-(?:file|request)-size|server\.tomcat\.max-(?:http-form-post|swallow)-size|max-(?:file|request)-size|max-http-form-post-size|max-swallow-size)\s*[=:]\s*["']?-1\b/
  },
  // ASP.NET Core's limit turned off for an action, or for the server.
  { files: /\.cs$/i, pattern: /\[\s*DisableRequestSizeLimit\s*\]|\bMaxRequestBodySize\s*=\s*null\b|\b(?:MultipartBodyLengthLimit|ValueLengthLimit|MaxRequestBodySize)\s*=\s*(?:long|int)\.MaxValue\b/ },
  // PHP's post_max_size 0, which turns the limit off.
  { files: /\.ini$|(?:^|\/)\.htaccess$/i, pattern: /^\s*(?:php_value\s+)?post_max_size\s*=?\s*0\s*$/ }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const requestSizeLimitRule: Rule = {
  id: "request-size-limit",
  description: "Flags request body limits turned off or set to 100 MB or more for parsers that read the whole body into memory.",
  run({ files, config }) {
    if (!config.rules.requestSizeLimit.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const javascript = /\.(?:[cm]?[jt]sx?)$/i.test(file.path);
      const settings = turnedOff.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (settings.length === 0 && !javascript) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps lift limits on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found: number[] = [];
      for (const { line, content, added } of patchLines(file.patch)) {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        if (settings.some(({ pattern }) => pattern.test(content)) || (javascript && liftsParserLimit(content))) {
          found.push(line);
        }
      }
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found);
      return [
        {
          ruleId: "request-size-limit",
          title: "Request size limit lifted",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${text} ${plural ? "turn off or raise" : "turns off or raises"} the limit on how large a request body can be, so a few large requests can fill the server's memory or keep it busy parsing, and take the service down for everyone.`,
          recommendation:
            "Keep a limit sized to what each route needs, such as the default 100 KB for JSON APIs and a separate, larger limit only on upload routes, and stream large uploads to storage instead of parsing them in memory."
        }
      ];
    });
  }
};

// A JSON, form, or text parser limit that is unlimited or 100 MB or more, or Fastify's bodyLimit.
function liftsParserLimit(content: string): boolean {
  const parser = parserLimit.exec(content);
  const value = parser?.[1] ?? parser?.[2];
  if (value !== undefined && isLarge(value)) {
    return true;
  }
  const fastify = fastifyLimit.exec(content)?.[1];
  return fastify !== undefined && (unlimitedValue.test(fastify) || bytes(fastify) >= largeMegabytes * 1024 * 1024);
}

function isLarge(value: string): boolean {
  if (unlimitedValue.test(value)) {
    return true;
  }
  const size = sizeText.exec(value);
  if (size !== null) {
    const amount = Number(size[1]);
    return /^g/i.test(size[2] ?? "") ? amount > 0 : amount >= largeMegabytes;
  }
  return bytes(value) >= largeMegabytes * 1024 * 1024;
}

// A byte count written as a number or a product such as `1024 * 1024 * 1024`.
function bytes(value: string): number {
  const product = /^\s*(\d+(?:\s*\*\s*\d+)*)\s*$/.exec(value);
  if (product === null) {
    return 0;
  }
  return product[1]!.split("*").reduce((total, factor) => total * Number(factor.trim()), 1);
}
