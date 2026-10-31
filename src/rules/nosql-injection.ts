import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "filter" | "where";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  filter: "puts a value from the request into a MongoDB filter, where an object such as `{\"$ne\": null}` matches any document",
  where: "builds a MongoDB `$where` expression from text, which runs as JavaScript on the database"
};

type Language = {
  files: RegExp;
  // A query whose first argument is the filter; the match ends after the opening parenthesis.
  query: RegExp;
  // Request values that can hold an object rather than text.
  request: RegExp;
  // Casts and checks that make the value plain text, on the same line.
  guard: RegExp;
};

const languages: Language[] = [
  {
    // Mongoose models and MongoDB collections. `findById` casts its argument, and arrays' `find` takes
    // a function, not a filter.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    query:
      /\.(?:find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|findOneAndRemove|updateOne|updateMany|deleteOne|deleteMany|replaceOne|countDocuments|count|exists|distinct|where)\s*\(\s*(?=[{\w])/g,
    // Express and Koa parse `a[$ne]=1` in a query string, and JSON bodies, into objects. Route
    // parameters are always text.
    request: /\b(?:req|request|ctx(?:\.request)?)\.(?:body|query)\b/,
    guard: /\bString\s*\(|\.toString\s*\(|\bNumber\s*\(|\bparseInt\s*\(|\bparseFloat\s*\(|\bBoolean\s*\(|ObjectId\s*\(|\bsanitize\w*\s*\(|\$eq\s*:|`[^`]*\$\{[^}]*(?:req|request|ctx)/
  },
  {
    // PyMongo and Motor. Flask's `request.args` and `request.form` hold text; JSON bodies hold objects.
    files: /\.py$/i,
    query:
      /\.(?:find|find_one|find_one_and_update|find_one_and_delete|find_one_and_replace|update_one|update_many|delete_one|delete_many|replace_one|count_documents|distinct)\s*\(\s*(?=[{\w])/g,
    request: /\brequest\.(?:json\b|data\b|body\b|get_json\s*\()|\bjson\.loads\s*\(\s*request\b/,
    guard: /\bstr\s*\(|\bint\s*\(|\bfloat\s*\(|\bbool\s*\(|ObjectId\s*\(|\$eq["']?\s*:/
  },
  {
    // The MongoDB PHP library. `a[$ne]=1` arrives as an array.
    files: /\.php$/i,
    query:
      /->(?:find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|updateOne|updateMany|deleteOne|deleteMany|replaceOne|countDocuments|count|distinct)\s*\(\s*(?=[[\w$])/g,
    request: /\$_(?:GET|POST|REQUEST|COOKIE)\b|\$request->(?:input|get|query|post|all)\s*\(/,
    guard: /\(\s*string\s*\)|\bstrval\s*\(|\(\s*int\s*\)|\bintval\s*\(|ObjectId\s*\(|\$eq['"]?\s*=>/
  }
];

// `$where` with text built from pieces: `"this.a == '" + x + "'"`, `` `...${x}` ``, or f-strings.
const whereExpression = /["']?\$where["']?\s*(?::|=>)\s*(?:`[^`]*\$\{|f["']|["'][^"']*["']\s*(?:\+|\.)|\w[\w.]*\s*\+)/;
// Names taken out of the request, as in `const { email, password } = req.body`.
const destructuring = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?((?:req|request|ctx(?:\.request)?)\.(?:body|query))\b/;
// Objects taken whole from the request, as in `const body = req.body` or `data = request.get_json()`.
const requestObject =
  /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:(?:req|request|ctx(?:\.request)?)\.(?:body|query)|request\.(?:json|get_json\s*\(\s*\))|json\.loads\s*\(\s*request\b)\s*;?\s*$/;
const parsers = /^(?:JSON|EJSON|qs|querystring|json|bson)\.(?:parse|loads|load)$/;
// Service and repository layers, such as Directus's `service.updateMany(keys)`, Strapi's
// `getService("user").exists(...)`, or Feathers' `app.service("users").find(...)`, take keys or their own
// query format and validate it. A Mongoose model named `Service` is still read.
const serviceReceiver = /(?:\b(?:service|repository)|[\w$]Service|[\w$]Repository)(?:\s*\([^()]*\))?\s*$/;
// Sequelize, TypeORM, and Prisma wrap the filter in `where`, and do not read `$ne` from a plain object.
const sqlOrmFilter = /^\s*\{\s*where\s*:/;
// How far, in lines, a filter written over several lines is read.
const filterReach = 12;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const nosqlInjectionRule: Rule = {
  id: "nosql-injection",
  description: "Flags request values used as MongoDB filters without a cast to text, and $where expressions built from text.",
  run({ files, config }) {
    if (!config.rules.nosqlInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (
        language === undefined ||
        file.patch === undefined ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findIssues(patchLines(file.patch), language);
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "nosql-injection",
          title: "Request value in a MongoDB query",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${kinds.map((kind) => (plural ? labels[kind].replace(/^(\w+)s /, "$1 ") : labels[kind])).join(", and ")}.`,
          recommendation:
            "Turn each request value into the type the query expects before using it, such as `String(req.body.email)` or `str(data[\"email\"])`, or match it with `$eq`. Validate request bodies with a schema, enable Mongoose's `sanitizeFilter`, or strip `$` keys with a package such as express-mongo-sanitize. Never build `$where` from text; use query operators instead."
        }
      ];
    });
  }
};

function findIssues(lines: PatchLine[], language: Language): Array<{ line: number; kind: Kind }> {
  const requestNames = new Set<string>();
  const requestObjects = new Set<string>();
  const issues: Array<{ line: number; kind: Kind }> = [];

  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength || commentLine.test(content)) {
      return;
    }
    const object = requestObject.exec(content)?.[1];
    if (object !== undefined) {
      requestObjects.add(object);
    }
    const names = destructuring.exec(content);
    if (names !== null) {
      for (const part of (names[1] ?? "").split(",")) {
        // `{ email }`, `{ email: login }`, and `{ email = "" }` bind `email`, `login`, and `email`.
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== undefined && !part.includes("...")) {
          requestNames.add(name);
        }
      }
    }
    if (!added) {
      return;
    }
    if (whereExpression.test(content)) {
      issues.push({ line, kind: "where" });
    }
    language.query.lastIndex = 0;
    for (const match of content.matchAll(language.query)) {
      if (serviceReceiver.test(content.slice(0, match.index))) {
        continue;
      }
      const filter = filterText(lines, index, match.index + match[0].length);
      if (filterUsesRequest(filter, language, requestNames, requestObjects)) {
        issues.push({ line, kind: "filter" });
        break;
      }
    }
  });
  return issues;
}

// The filter argument: the rest of the line, and when an object is left open, the lines after it
// until it closes.
function filterText(lines: PatchLine[], index: number, start: number): string {
  const first = lines[index]?.content.slice(start) ?? "";
  let depth = 0;
  let text = "";
  for (const [offset, content] of [first, ...lines.slice(index + 1, index + filterReach).map((line) => line.content)].entries()) {
    for (const char of content) {
      if ("{[(".includes(char)) {
        depth += 1;
      } else if ("}])".includes(char)) {
        depth -= 1;
        if (depth < 0) {
          return text;
        }
      } else if (char === "," && depth === 0) {
        return text;
      }
      text += char;
    }
    text += "\n";
    if (offset === 0 && depth === 0) {
      return text;
    }
  }
  return text;
}

function filterUsesRequest(filter: string, language: Language, requestNames: Set<string>, requestObjects: Set<string>): boolean {
  if (sqlOrmFilter.test(filter)) {
    return false;
  }
  // The whole request as the filter, as in `find(req.query)`.
  if (new RegExp(`^\\s*(?:${language.request.source})\\s*$`).test(filter)) {
    return true;
  }
  // A value of the filter that comes from the request, unless its own line casts or checks it.
  return filter.split(/,|\n/).some((part) => {
    if (language.guard.test(part)) {
      return false;
    }
    const value = /(?::|=>)\s*(.*)$/s.exec(part)?.[1] ?? part;
    // A value passed through a function, such as `launder.string(req.body.id)` or `normalizeEmail(...)`,
    // comes back as whatever that function returns, usually text. Parsers return objects.
    const wrapper = /^\s*([\w$.]+)\s*\(/.exec(value)?.[1];
    const fromRequest = new RegExp(`^\\s*(?:${language.request.source})`).test(value);
    if (wrapper !== undefined && !fromRequest && !parsers.test(wrapper)) {
      return false;
    }
    if (language.request.test(value) && !/^\s*\{?\s*$/.test(value)) {
      return true;
    }
    // Names destructured from the request, as values or shorthand properties: `{ email, password }`.
    const name = /^[\s{]*([A-Za-z_$][\w$]*)[\s}]*$/.exec(value)?.[1];
    if (name !== undefined && requestNames.has(name)) {
      return true;
    }
    // A field of an object taken from the request: `body.email`, `data["email"]`, or `data.get("email")`.
    const object = /^[\s{]*([A-Za-z_$][\w$]*)\s*(?:\.(?!length\b)\w|\[|\.get\s*\()/.exec(value)?.[1];
    return object !== undefined && requestObjects.has(object);
  });
}
