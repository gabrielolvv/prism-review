import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { railsParams, requestValue } from "./untrusted-input.js";

// Calls that compile text into a template, and which argument holds that text. The pattern ends at
// the call's opening parenthesis, or for Ruby's `render inline:`, after the key.
type Sink = { label: string; files: RegExp; call: RegExp; argument: number | "inline" };

const python = /\.py$/i;
const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const ruby = /\.(?:rb|erb|rake)$/i;

const sinks: Sink[] = [
  // Flask, Jinja, Django, and Mako. `string.Template` only substitutes values and runs no code.
  { label: "render_template_string", files: python, call: /\brender_template_string\s*\(/g, argument: 0 },
  { label: "Template", files: python, call: /(?<![.\w])(?:jinja2\.|mako\.template\.)?Template\s*\(/g, argument: 0 },
  { label: "from_string", files: python, call: /\.from_string\s*\(/g, argument: 0 },
  // EJS, Handlebars, Pug, Nunjucks, Lodash, Underscore, and doT.
  {
    label: "template compile",
    files: javascript,
    call: /\b(?:ejs\.(?:render|compile)|Handlebars\.(?:compile|precompile)|handlebars\.(?:compile|precompile)|pug\.(?:render|compile)|jade\.(?:render|compile)|nunjucks\.renderString|_\.template|lodash\.template|doT\.(?:template|compile)|dot\.(?:template|compile))\s*\(/g,
    argument: 0
  },
  { label: "env.renderString", files: javascript, call: /\b\w*[eE]nv\w*\.renderString\s*\(/g, argument: 0 },
  // ERB, Haml, and Slim, and Rails' `render inline:`.
  { label: "ERB.new", files: ruby, call: /\b(?:ERB|Erubi::Engine|Erubis::Eruby|Haml::Engine|Haml::Template|Slim::Template|Tilt::\w+Template)\.new\s*\(/g, argument: 0 },
  { label: "render inline", files: ruby, call: /\brender\s*\(?\s*inline:\s*/g, argument: "inline" },
  // Twig, Blade, and Smarty's `string:` resources.
  { label: "createTemplate", files: /\.php$/i, call: /->createTemplate\s*\(|\bBlade::render\s*\(/g, argument: 0 },
  { label: "Smarty string:", files: /\.php$/i, call: /->(?:fetch|display)\s*\(\s*(?=["'](?:string|eval):)/g, argument: 0 },
  // Velocity evaluates its fourth argument; FreeMarker reads a template from a StringReader.
  { label: "Velocity.evaluate", files: /\.(?:java|kt)$/i, call: /\b(?:Velocity|velocityEngine|engine|ve)\.evaluate\s*\(/g, argument: 3 },
  { label: "FreeMarker Template", files: /\.(?:java|kt)$/i, call: /\bnew\s+Template\s*\([^()]*,\s*new\s+StringReader\s*\(/g, argument: 0 },
  // Go's text/template and html/template.
  { label: "template.Parse", files: /\.go$/i, call: /\btemplate\.(?:New\s*\([^()]*\)\s*(?:\.\w+\([^()]*\)\s*)*|Must\s*\(\s*template\.New\s*\([^()]*\)\s*)\.Parse\s*\(/g, argument: 0 }
];

// Servlet request values, which untrusted-input leaves to other rules.
const servletValue = /\b(?:request|req|httpRequest|servletRequest|httpServletRequest)\.get(?:Parameter|ParameterValues|Header|QueryString|Reader|InputStream)\s*\(/;
const java = /\.(?:java|kt)$/i;

// A name assigned from the request, as in `name = request.args.get("name")` or
// `const { template } = req.body`. Only names on the left of the first `=` count.
const assignment = /^\s*(?:(?:const|let|var|final|String|string)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
// How far, in lines, a name assigned from the request is followed.
const reach = 30;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const templateInjectionRule: Rule = {
  id: "template-injection",
  description: "Flags templates compiled from text that comes from the request.",
  run({ files, config }) {
    if (!config.rules.templateInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSinks = sinks.filter((sink) => sink.files.test(file.path));
      if (
        fileSinks.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const isRuby = ruby.test(file.path);
      const isJava = java.test(file.path);
      const fromRequest = (text: string) =>
        requestValue.test(text) || (isRuby && railsParams.test(text)) || (isJava && servletValue.test(text));
      // Names assigned from the request, with the line they were assigned on.
      const tainted = new Map<string, number>();
      const found: Array<{ line: number; label: string }> = [];

      for (const { line, content, added } of patchLines(file.patch)) {
        if (content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        const isTainted = (text: string) =>
          fromRequest(text) ||
          [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));

        if (added) {
          for (const sink of fileSinks) {
            sink.call.lastIndex = 0;
            const match = sink.call.exec(content);
            if (match !== null && isTainted(templateArgument(content.slice(match.index + match[0].length), sink.argument))) {
              found.push({ line, label: sink.label });
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
          if (isTainted(single[2] ?? "")) {
            tainted.set(single[1], line);
          } else {
            tainted.delete(single[1]);
          }
        }
      }

      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = [...new Set(found.map((match) => match.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "template-injection",
          title: "Template built from request input",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compile templates" : "compiles a template"} from text that comes from the request (${kinds.join(", ")}), so a request can write template code, such as \`{{ ... }}\`, that runs on the server.`,
          recommendation:
            "Keep templates in files or fixed strings and pass request values only as variables, such as `render_template(\"page.html\", name=name)` or `ejs.render(template, { name })`. If users must write templates, use a sandboxed, logic-less engine such as Mustache or Liquid."
        }
      ];
    });
  }
};

// The text of one argument, from just after the opening parenthesis, as far as the line goes.
// Commas inside strings and brackets do not split arguments.
function templateArgument(rest: string, argument: number | "inline"): string {
  if (argument === "inline") {
    return splitArguments(rest)[0] ?? "";
  }
  return splitArguments(rest)[argument] ?? "";
}

function splitArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (quote !== undefined) {
      current += char;
      if (char === "\\") {
        current += text[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  args.push(current);
  return args;
}
