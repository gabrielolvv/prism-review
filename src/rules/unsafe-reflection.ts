import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { servletValue, splitArguments } from "./template-injection.js";
import { railsParams, requestValue } from "./untrusted-input.js";

// Calls that load a module or class, or call a method, by a name given as text. `argument` says
// where the name is: an argument of the call, the receiver before it, as in Ruby's
// `params[:type].constantize`, or the first group of the pattern, as in `handlers[name](...)`.
type Sink = { label: string; files: RegExp; call: RegExp; argument: number | "receiver" | "group" };

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const python = /\.py$/i;
const ruby = /\.(?:rb|erb|rake)$/i;
const java = /\.(?:java|kt)$/i;
const php = /\.php$/i;

const sinks: Sink[] = [
  { label: "require", files: javascript, call: /(?<![\w$.])(?:require|import)\s*\(/g, argument: 0 },
  // A method looked up by name and called, as in `res[req.query.output](result)`. A table named as
  // one, such as `handlers[name]` or `sectionToController[section]`, maps names to fixed functions.
  { label: "method by name", files: javascript, call: /(?<![\w$.])(?!\w*(?:[mM]ap|[tT]able|[hH]andlers?|[aA]ctions|[cC]ontrollers?|[rR]outes|[cC]onverters?|[cC]ommands|[sS]trategies|[fF]ormatters|[rR]enderers?)\b)(?![a-z]\w*To[A-Z]\w*\b)[\w$]+(?:\.[\w$]+)*\s*\[([^[\]]+)\]\s*\(/g, argument: "group" },
  { label: "import_module", files: python, call: /\b(?:importlib\.import_module|__import__)\s*\(/g, argument: 0 },
  { label: "getattr", files: python, call: /(?<![\w.])getattr\s*\(/g, argument: 1 },
  { label: "globals()", files: python, call: /\b(?:globals|locals|vars)\s*\(\s*\)\s*\[([^[\]]+)\]/g, argument: "group" },
  { label: "constantize", files: ruby, call: /\.(?:safe_)?constantize\b/g, argument: "receiver" },
  { label: "const_get", files: ruby, call: /\bconst_get\s*\(/g, argument: 0 },
  { label: "send", files: ruby, call: /\.(?:send|public_send|__send__|method|try)\s*\(/g, argument: 0 },
  { label: "Class.forName", files: java, call: /\bClass\.forName\s*\(|\.loadClass\s*\(|\.get(?:Declared)?Method\s*\(/g, argument: 0 },
  { label: "Type.GetType", files: /\.cs$/i, call: /\bType\.GetType\s*\(|\bAssembly\.Load\w*\s*\(|\.GetMethod\s*\(|\bActivator\.CreateInstance\s*\(/g, argument: 0 },
  { label: "call_user_func", files: php, call: /\bcall_user_func(?:_array)?\s*\(/g, argument: 0 },
  // `new $class()`, `$function()`, `$object->$method()`, and `$_GET['f']()`.
  { label: "variable function", files: php, call: /(?:\bnew\s+|->\s*|(?<![\w$>:]))(\$\w+(?:\[[^\]]+\])?)\s*\(/g, argument: "group" },
  { label: "MethodByName", files: /\.go$/i, call: /\.MethodByName\s*\(/g, argument: 0 }
];

// A check of the name against a fixed list, before or around the call: `%w[a b].include?(type)`,
// `if name in ALLOWED`, `in_array($f, $allowed)`, `allowed.includes(action)`, or an allowlist name.
const allowlist =
  /\.include\?\s*\(|\bin_array\s*\(|\.(?:includes|has|contains|containsKey|hasOwnProperty)\s*\(|\bObject\.hasOwn\s*\(|\(\s*!?\s*\(?\s*[\w.$]+\s+in\s+[\w.$]+\s*\)|\bin\s+(?:\(|\[|\{|[A-Z_]{3,}|self\.[A-Z_]{3,})|\b\w*(?:[aA]llow(?:ed)?[A-Z_]?|ALLOW|[wW]hitelist|WHITELIST|[pP]ermitted|PERMITTED)\w*/;
// How far, in lines, a name assigned from the request is followed, and a check before a call is looked for.
const reach = 30;
const checkReach = 10;

const assignment = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const unsafeReflectionRule: Rule = {
  id: "unsafe-reflection",
  description: "Flags modules, classes, and methods loaded or called by a name that comes from the request.",
  run({ files, config }) {
    if (!config.rules.unsafeReflection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSinks = sinks.filter((sink) => sink.files.test(file.path));
      if (
        fileSinks.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findCalls(file.patch, file.path, fileSinks);
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = [...new Set(found.map((match) => match.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "unsafe-reflection",
          title: "Code chosen by request input",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "load or call code" : "loads or calls code"} by a name that comes from the request (${kinds.join(", ")}), so a request can pick any module, class, or method the process can reach, such as \`eval\`, \`system\`, or \`constructor\`.`,
          recommendation:
            "Map the request value to the code it may run with a fixed table, such as `{ csv: CsvExporter, pdf: PdfExporter }[format]`, or check it against a list of allowed names before the call. Never pass request input to `require`, `constantize`, `send`, `getattr`, `Class.forName`, or `call_user_func`."
        }
      ];
    });
  }
};

function findCalls(patch: string, path: string, fileSinks: Sink[]): Array<{ line: number; label: string }> {
  const isRuby = ruby.test(path);
  const isJava = java.test(path);
  const fromRequest = (text: string) =>
    requestValue.test(text) || (isRuby && railsParams.test(text)) || (isJava && servletValue.test(text));
  // Names assigned from the request, with the line they were assigned on.
  const tainted = new Map<string, number>();
  const found: Array<{ line: number; label: string }> = [];
  const lines = patchLines(patch);

  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength || commentLine.test(content)) {
      return;
    }
    const isTainted = (text: string) =>
      fromRequest(text) ||
      [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text));

    if (added && !checkedNearby(lines, index)) {
      for (const sink of fileSinks) {
        for (const match of content.matchAll(sink.call)) {
          if (isTainted(nameText(content, match, sink.argument))) {
            found.push({ line, label: sink.label });
          }
        }
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
    const single = assignment.exec(content);
    if (single !== null && single[1] !== undefined) {
      const value = single[2] ?? "";
      if (isTainted(value) && !allowlist.test(value)) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  });
  return found;
}

// The text that names what is loaded or called, without quoted text: a name in quotes, as in
// `getattr(view, 'ordering')`, is fixed, and so is a name after a fixed prefix, as in
// `getattr(actions, f"on_{name}")` or `"on_" + name`. Template literals are kept otherwise, since
// `` require(`./plugins/${name}`) `` loads whatever the name says.
function nameText(content: string, match: RegExpMatchArray, argument: Sink["argument"]): string {
  let text: string;
  if (argument === "group") {
    text = match[1] ?? "";
  } else if (argument === "receiver") {
    // The expression before `.constantize`, back to the start of the statement.
    text = /[^\s=(,]*$/.exec(content.slice(0, match.index))?.[0] ?? "";
  } else {
    text = splitArguments(content.slice((match.index ?? 0) + match[0].length))[argument] ?? "";
  }
  // A path prefix such as `./plugins/` does not limit what `../` reaches, so only names count.
  if (/^\s*(?:[fF]?["']|`)[A-Za-z_][\w:-]*(?=[{$"'`]|\s*\+)/.test(text)) {
    return "";
  }
  return text.replace(/([rRbBuUfF]{0,2})(["'])(?:\\.|(?!\2)[^\\])*\2/g, (quoted) => " ".repeat(quoted.length));
}

// An allowlist check on the call's line or in the lines just before it, in the same hunk.
function checkedNearby(lines: Array<{ content: string; startsHunk: boolean }>, index: number): boolean {
  for (let other = index; other >= Math.max(0, index - checkReach); other -= 1) {
    if (allowlist.test(lines[other]?.content ?? "")) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  return false;
}
