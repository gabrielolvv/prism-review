import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "permit-all" | "all-fields" | "unguarded" | "whole-request";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  "permit-all": "permits every request parameter",
  "all-fields": "lets a form or serializer write every model field",
  unguarded: "makes every model attribute mass assignable",
  "whole-request": "passes the whole request body to a model"
};

const patterns: Array<[Kind, RegExp]> = [
  // Rails strong parameters: `params.require(:user).permit!` and `params.to_unsafe_h`, but not after
  // `.slice(...)`, which already kept only the listed keys, as Devise does.
  ["permit-all", /^(?!.*\.slice\s*\().*(?:\.permi[t]!|\bparams\.to_unsafe_h(?:ash)?\b)/],
  // Laravel: an empty `$guarded` list, or `Model::unguard()`.
  ["unguarded", /\$guarded\s*=\s*(?:\[\s*\]|array\(\s*\))|\b\w+::unguard\s*\(\s*\)/],
  // Express with Mongoose, Sequelize, Prisma, or TypeORM: the body as the data of a write, or copied
  // onto a model.
  [
    "whole-request",
    /\.(?:create|insert|insertOne|insertMany|update|updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|upsert|build|save|merge|set)\s*\(\s*(?:[^,()]{1,200},\s*)?(?:\{\s*\.\.\.\s*)?(?:req|request|ctx\.request)\.body\s*\}?\s*[,)]|\bObject\.assign\s*\(\s*\w[\w.]*\s*,\s*(?:req|request|ctx\.request)\.body\s*\)|\bnew\s+[A-Z]\w*\s*\(\s*(?:req|request|ctx\.request)\.body\s*\)|\bdata\s*:\s*(?:req|request|ctx\.request)\.body\b/
  ],
  // Flask and Django: every field of the request as keyword arguments, such as `User(**request.json)`.
  ["whole-request", /\*\*\s*request\.(?:json|form|args|values|data|POST|GET|get_json\(\s*\))/],
  // ASP.NET MVC: TryUpdateModel without a list of properties binds every one of them.
  ["whole-request", /\bTryUpdateModel(?:Async)?(?:<[^>]{1,100}>)?\s*\(\s*\w+\s*\)/]
];

// Hashes and HMACs also have `update`, which reads the body rather than writing a model.
const digest = /\bcreate(?:Hash|Hmac)\b|\bhmac\b|\.digest\s*\(/i;

// Django's ModelForm and Django REST framework's ModelSerializer with `fields = "__all__"`.
const allFields = /^\s*fields\s*=\s*["']__all__["']/;
// django-filter's FilterSet uses the same Meta option to choose what can be filtered, not written.
const filterSet = /\bFilterSet\b|(?:^|\/)filters?\.py$/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;

export const massAssignmentRule: Rule = {
  id: "mass-assignment",
  description: "Flags code that lets a request set every field of a model, such as Rails' permit!, Django's fields = \"__all__\", or a model created from the whole request body.",
  run({ files, config }) {
    if (!config.rules.massAssignment.enabled) {
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

      const lines = patchLines(file.patch);
      const filters = filterSet.test(file.path) || lines.some(({ content }) => filterSet.test(content));
      const found = lines.flatMap(({ line, content, added }) => {
        if (!added || commentLine.test(content)) {
          return [];
        }
        const kinds = patterns
          .filter(([kind, pattern]) => pattern.test(content) && !(kind === "whole-request" && digest.test(content)))
          .map(([kind]) => kind);
        if (/\.py$/.test(file.path) && !filters && allFields.test(content)) {
          kinds.push("all-fields");
        }
        return [...new Set(kinds)].map((kind) => ({ line, kind }));
      });
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const numbers = [...new Set(found.map((match) => match.line))];
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "mass-assignment",
          title: "Mass assignment",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...numbers),
          lines: numbers,
          message: `${text} ${plural ? "let" : "lets"} a request set fields it should not, such as a role or an owner: the code ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "List the fields a request may set: permit(:name, :email) in Rails, an explicit fields list in Django forms and serializers, $fillable in Laravel, and picking the expected properties from the body before a create or update."
        }
      ];
    });
  }
};

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
