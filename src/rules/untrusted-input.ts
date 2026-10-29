import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "redirect" | "ssrf" | "path";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  redirect: "redirects to a URL from the request, which can send users to any site",
  ssrf: "requests a URL from the request, which can reach internal services",
  path: "reads or writes a file path from the request, which can leave the intended directory"
};

// Values the person sending the request chooses: Express and Koa, Flask and Django, PHP, Go's
// net/http, Rails, ASP.NET Core, and Next.js search parameters.
const requestValue =
  /\b(?:req|request|ctx(?:\.request)?)\.(?:query|params|body|headers|cookies|url)\b|\brequest\.(?:args|form|values|json|get_json\(|GET|POST|COOKIES|META|FILES|data|query_params)\b|\$_(?:GET|POST|REQUEST|COOKIE|SERVER\[\s*["']HTTP_)|\br\.(?:URL\.Query\(\)|FormValue\(|PostFormValue\(|Header\.Get\()|\bparams\[|\bRequest\.(?:Query|Form|Headers|Cookies)\[|\bsearchParams\.get\(/;

const sinks: Array<[Kind, RegExp]> = [
  [
    "redirect",
    /\b(?:res|reply|ctx|response)\.redirect\s*\(|(?:^|[^\w.])redirect\s*\(|\bHttpResponseRedirect\s*\(|\bheader\s*\(\s*["']Location:|\bhttp\.Redirect\s*\(|\bredirect_to\b|\bRedirect(?:Permanent)?\s*\(|\.location(?:\.href)?\s*=/
  ],
  [
    "ssrf",
    /(?:^|[^\w.])fetch\s*\(|\baxios(?:\.(?:get|post|put|patch|delete|head|request))?\s*\(|\bgot(?:\.(?:get|post))?\s*\(|\bhttps?\.(?:get|request)\s*\(|\brequests\.(?:get|post|put|patch|delete|head|request)\s*\(|\burlopen\s*\(|\bhttpx\.(?:get|post|put|delete|request|AsyncClient)\b|\bhttp\.(?:Get|Post|Head|NewRequest(?:WithContext)?)\s*\(|\bcurl_init\s*\(|\bNet::HTTP\.get\b|\bURI\.open\s*\(|\.(?:GetAsync|PostAsync|GetStringAsync)\s*\(/
  ],
  [
    "path",
    /\bfs(?:\.promises)?\.(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync|createWriteStream|appendFile|unlink|unlinkSync|rm|rmSync|readdir|stat)\s*\(|\b(?:res|reply)\.(?:sendFile|download)\s*\(|\bpath\.(?:join|resolve)\s*\(|(?:^|[^\w.])open\s*\(|\bos\.path\.join\s*\(|\bsend_file\s*\(|\b(?:include|require)(?:_once)?\s*\(?\s*\$|\b(?:file_get_contents|fopen|readfile|unlink)\s*\(|\bos\.(?:Open|OpenFile|ReadFile|WriteFile|Remove)\s*\(|\bfilepath\.Join\s*\(|\bhttp\.ServeFile\s*\(|\bFile\.(?:read|open|ReadAllText|ReadAllBytes|Delete)\s*\(|\bsend_file\b/
  ]
];

// The same line already checks or reduces the value.
const guarded: Record<Kind, RegExp> = {
  redirect: /\b(?:url_has_allowed_host_and_scheme|is_safe_url|isLocalUrl|IsLocalUrl|LocalRedirect|safeRedirect|allowedHosts?)\b/,
  ssrf: /\b(?:allowedHosts?|isAllowedUrl|ALLOWED_HOSTS)\b/,
  path: /\b(?:path\.basename|basename|secure_filename|filepath\.Base|Path\.GetFileName|File\.basename|sanitize\w*)\s*\(/
};

// A redirect or request whose target starts as text with a path on the same site, or with a fixed
// host, only lets the request choose what follows. `/${...}` is not fixed: it can become `//host`.
const fixedTarget = /^\s*\(?\s*(["'`])(?:\/(?![\/$])|https?:\/\/[\w.-]+(?:[:/?]|\1))/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const untrustedInputRule: Rule = {
  id: "untrusted-input",
  description: "Flags request values passed straight to redirects, outgoing requests, and file paths.",
  run({ files, config }) {
    if (!config.rules.untrustedInput.enabled) {
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

      const found = patchLines(file.patch).flatMap(({ line, content, added }) =>
        added && !commentLine.test(content) && requestValue.test(content)
          ? sinks.filter(([kind, sink]) => reaches(content, kind, sink)).map(([kind]) => ({ line, kind }))
          : []
      );
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const lines = [...new Set(found.map((match) => match.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "untrusted-input",
          title: "Request input used unchecked",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "pass" : "passes"} a value from the request straight to code that ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "Check the value against a list of allowed hosts, paths, or redirect targets first. Redirect only to relative paths on your own site, fetch only hosts you expect, and reduce file names with a function such as path.basename before joining them to a directory."
        }
      ];
    });
  }
};

function reaches(content: string, kind: Kind, sink: RegExp): boolean {
  const match = sink.exec(content);
  if (match === null || guarded[kind].test(content)) {
    return false;
  }
  return kind === "path" || !fixedTarget.test(content.slice(match.index + match[0].length));
}

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
