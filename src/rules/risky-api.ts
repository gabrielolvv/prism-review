import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Language = {
  files: RegExp;
  calls: Array<[string, RegExp]>;
  definitions?: RegExp;
  comment: RegExp;
  // Python reads only the code outside triple-quoted strings, where docstrings mention `eval()`.
  docstrings?: boolean;
};

const slashComment = /^\s*(?:\/\/|\/\*|\*)/;
const hashComment = /^\s*#/;
// Minified and bundled code puts a whole file on a few lines.
const maxLineLength = 1_000;

// Assembled so this file does not match its own pattern.
const rawHtmlProp = ["dangerously", "SetInnerHTML"].join("");

// Each call runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML.
// Member calls such as `pattern.exec(input)` and `model.eval()` are excluded by the lookbehinds,
// and `definitions` skips lines that define a function or method with the same name.
// `exe[c]` keeps these lines from containing the call they describe.
const languages: Language[] = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
    comment: slashComment,
    calls: [
      ["eval", /(?<![.\w$])eval\s*\(|\b(?:window|globalThis|self)\.eval\s*\(/],
      ["Function constructor", /\bnew\s+Function\s*\(/],
      [
        "child_process exec",
        /(?<![.\w$])exe[c](?:Sync)?\s*\(|\b(?:child_process|childProcess|cp)\.exe[c](?:Sync)?\s*\(/
      ],
      ["shell option", /\bshell\s*:\s*true\b/],
      [rawHtmlProp, new RegExp(`\\b${rawHtmlProp}\\b`)],
      ["innerHTML assignment", /\.(?:inner|outer)HTML\s*\+?=(?!=)/],
      ["document.write", /\bdocument\.write(?:ln)?\s*\(/]
    ],
    definitions:
      /^\s*(?:(?:export|default|async|static|public|private|protected|override)\s+)*(?:function\s*\*?\s*)?(?:eval|exe[c](?:Sync)?)\s*\([^)]*\)\s*(?::[^{]*)?\{/
  },
  {
    files: /\.py$/,
    comment: hashComment,
    docstrings: true,
    calls: [
      ["eval", /(?<![.\w])eval\s*\(/],
      ["exec", /(?<![.\w])exe[c]\s*\(/],
      ["pickle", /\b(?:c?pickle|marshal|shelve)\.loads?\s*\(/],
      [
        "yaml.load",
        /\byaml\.(?:load(?:_all)?\s*\((?!.{0,500}\b(?:Safe|CSafe|Base)Loader\b)|unsafe_load(?:_all)?\s*\()/
      ],
      ["shell=True", /\bshell\s*=\s*True\b/],
      ["os.system", /\bos\.(?:system|popen)\s*\(/]
    ],
    definitions: /^\s*(?:async\s+)?def\s+\w+\s*\(/
  },
  {
    files: /\.(?:rb|rake|erb)$/,
    comment: hashComment,
    calls: [
      // A string, heredoc, or variable is evaluated; a `do` or `{` block is not.
      [
        "eval",
        /(?<![.\w:])(?:eval|instance_eval|class_eval|module_eval)\b\s*\(?\s*(?:["'`]|<<[~-]?|%[qQ]?[({[]|(?!do\b)[a-z_@$][\w@$]*)|\bKernel\.eval\b/
      ],
      // A command and its arguments as separate strings or a splat, as in `system("git", "status")` or
      // `system("git", *args)`, run without a shell; a single string goes through one, even with
      // options such as `exception: true` after it.
      [
        "shell command",
        /(?:(?<![.\w:])|(?<=\b(?:Kernel|Process)\.))(?:system|exe[c]|spawn)\b\s*[(\s]\s*(?:`|(["'])(?:\\.|(?!\1).)*\1(?!\s*,\s*["'*]))/
      ],
      // Backticks only run a command outside a string literal.
      ["interpolated shell command", /%x[({[]|^[^"'`]*(?:(?:"[^"]*"|'[^']*')[^"'`]*)*`[^`]*#\{/],
      ["Marshal.load", /\bMarshal\.load\b/],
      ["YAML.unsafe_load", /\b(?:YAML|Psych)\.unsafe_load\b/],
      ["html_safe or raw", /\.html_safe\b|(?<![.\w])raw\s*\(/]
    ],
    definitions: /^\s*def\s+/
  },
  {
    files: /\.(?:java|kt)$/,
    comment: slashComment,
    calls: [
      ["Runtime exec", /\bRuntime\.getRuntime\(\)\.exe[c]\s*\(/],
      [
        "shell command",
        /\bProcessBuilder\s*\(\s*(?:(?:List\.of|listOf|Arrays\.asList)\s*\()?\s*"(?:[^"]*\/)?(?:sh|bash|zsh|cmd(?:\.exe)?|powershell(?:\.exe)?)"\s*,\s*"(?:-[a-zA-Z]*c|\/[cC]|-Command)"/
      ],
      ["Java deserialization", /\b(?:ObjectInputStream|XMLDecoder)\s*\(/]
    ]
  },
  {
    // `->` and `::` mark method calls, which are excluded like member calls in JavaScript.
    files: /\.php$/,
    comment: /^\s*(?:\/\/|\/\*|\*|#(?!\[))/,
    calls: [
      ["eval", /(?<![>\w$:])eval\s*\(/],
      ["shell command", /(?<![>\w$:])(?:exe[c]|shell_exec|system|passthru|popen|proc_open)\s*\(/],
      ["unserialize", /(?<![>\w$:])unserialize\s*\(/]
    ],
    definitions: /^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+/
  },
  {
    files: /\.(?:cs|cshtml|razor)$/,
    comment: slashComment,
    calls: [
      [
        "shell command",
        /\b(?:Process\.Start\s*\(|FileName\s*=)\s*"(?:[^"]*[\/\\])?(?:cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh|sh|bash|zsh)"/
      ],
      ["unsafe .NET deserializer", /\b(?:BinaryFormatter|SoapFormatter|NetDataContractSerializer|LosFormatter|ObjectStateFormatter)\b/],
      ["Html.Raw", /\bHtml\.Raw\s*\(/]
    ]
  },
  {
    files: /\.swift$/,
    comment: slashComment,
    calls: [
      ["shell process", /(?:fileURLWithPath:|launchPath\s*=)\s*"\/bin\/(?:sh|bash|zsh)"/],
      ["NSKeyedUnarchiver", /\bNSKeyedUnarchiver\.unarchiveObject\s*\(|\bNSUnarchiver\b/],
      // `\(` inside the string is Swift interpolation.
      ["interpolated evaluateJavaScript", /\bevaluateJavaScript\s*\(\s*"[^"]*\\\(/]
    ]
  },
  {
    files: /\.go$/,
    comment: slashComment,
    calls: [
      [
        "shell command",
        /\bexec\.Command(?:Context)?\s*\((?:[^,"]{0,200},\s*)?"(?:[^"]*\/)?(?:sh|bash|zsh|dash|ksh|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh)"\s*,\s*"(?:-[a-zA-Z]*c|\/[cC]|-Command)"/
      ],
      ["template.HTML", /\btemplate\.HTML\s*\(/]
    ]
  }
];

export const riskyApiRule: Rule = {
  id: "risky-api",
  description: "Flags added calls that run strings as code, start a shell, deserialize data, or write raw HTML.",
  run({ files, config }) {
    if (!config.rules.riskyApis.enabled) {
      return [];
    }

    // Tests call these on purpose, with fixed input.
    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (!language || file.patch === undefined || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const found = findCalls(patchLines(file.patch), language);
      if (found.length === 0) {
        return [];
      }

      const kinds = [...new Set(found.map((match) => match.label))];
      const { text, plural } = describeLines(found.map((match) => match.line));
      const many = plural || kinds.length > 1;

      return [
        {
          ruleId: "risky-api",
          title: "Risky API call added",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "add" : "adds"} ${many ? "calls that deserve" : "a call that deserves"} a security review: ${kinds.join(", ")}.`,
          recommendation:
            "Check that no user or pull request input reaches these calls, and prefer a safer alternative such as JSON.parse, execFile with an argument list, yaml.safe_load, or textContent."
        }
      ];
    });
  }
};

function findCalls(lines: PatchLine[], language: Language): Array<{ line: number; label: string }> {
  const code = language.docstrings ? outsideTripleQuotes(lines) : lines.map((line) => line.content);
  return lines.flatMap((line, index) => {
    const content = code[index] ?? "";
    if (
      !line.added ||
      line.content.length > maxLineLength ||
      language.comment.test(content) ||
      language.definitions?.test(content)
    ) {
      return [];
    }
    return language.calls.filter(([, pattern]) => pattern.test(content)).map(([label]) => ({ line: line.line, label }));
  });
}

// Each line's text outside triple-quoted strings. At the start of a hunk no string is taken to be
// open, so a call there is still read.
function outsideTripleQuotes(lines: PatchLine[]): string[] {
  let open: string | undefined;
  return lines.map((line) => {
    if (line.startsHunk) {
      open = undefined;
    }
    let code = "";
    let rest = line.content;
    while (rest.length > 0) {
      if (open !== undefined) {
        const end = rest.indexOf(open);
        if (end === -1) {
          break;
        }
        rest = rest.slice(end + 3);
        open = undefined;
        continue;
      }
      const start = /"""|'''/.exec(rest);
      if (start === null) {
        code += rest;
        break;
      }
      code += rest.slice(0, start.index);
      open = start[0];
      rest = rest.slice(start.index + 3);
    }
    return code;
  });
}
