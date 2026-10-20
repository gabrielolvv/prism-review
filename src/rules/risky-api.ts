import { minimatch } from "minimatch";
import { matchAddedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Language = { files: RegExp; calls: Array<[string, RegExp]>; definitions?: RegExp };

// Assembled so this file does not match its own pattern.
const rawHtmlProp = ["dangerously", "SetInnerHTML"].join("");

// Each call runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML.
// Member calls such as `pattern.exec(input)` and `model.eval()` are excluded by the lookbehinds,
// and `definitions` skips lines that define a function or method with the same name.
// `exe[c]` keeps these lines from containing the call they describe.
const languages: Language[] = [
  {
    files: /\.(?:[cm]?[jt]sx?|vue|svelte)$/,
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
    calls: [
      ["eval", /(?<![.\w])eval\s*\(/],
      ["exec", /(?<![.\w])exe[c]\s*\(/],
      ["pickle", /\b(?:c?pickle|marshal|shelve)\.loads?\s*\(/],
      [
        "yaml.load",
        /\byaml\.(?:load(?:_all)?\s*\((?!.*\b(?:Safe|CSafe|Base)Loader\b)|unsafe_load(?:_all)?\s*\()/
      ],
      ["shell=True", /\bshell\s*=\s*True\b/],
      ["os.system", /\bos\.(?:system|popen)\s*\(/]
    ],
    definitions: /^\s*(?:async\s+)?def\s+\w+\s*\(/
  },
  {
    files: /\.(?:rb|rake|erb)$/,
    calls: [
      // A string, heredoc, or variable is evaluated; a `do` or `{` block is not.
      [
        "eval",
        /(?<![.\w:])(?:eval|instance_eval|class_eval|module_eval)\b\s*\(?\s*(?:["'`]|<<[~-]?|%[qQ]?[({[]|(?!do\b)[a-z_@$][\w@$]*)|\bKernel\.eval\b/
      ],
      ["shell command", /(?:(?<![.\w:])|(?<=\b(?:Kernel|Process)\.))(?:system|exe[c]|spawn)\b\s*[(\s]\s*["'`]/],
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
    calls: [
      ["eval", /(?<![>\w$:])eval\s*\(/],
      ["shell command", /(?<![>\w$:])(?:exe[c]|shell_exec|system|passthru|popen|proc_open)\s*\(/],
      ["unserialize", /(?<![>\w$:])unserialize\s*\(/]
    ],
    definitions: /^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+/
  },
  {
    files: /\.(?:cs|cshtml|razor)$/,
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
    calls: [
      ["shell process", /(?:fileURLWithPath:|launchPath\s*=)\s*"\/bin\/(?:sh|bash|zsh)"/],
      ["NSKeyedUnarchiver", /\bNSKeyedUnarchiver\.unarchiveObject\s*\(|\bNSUnarchiver\b/],
      // `\(` inside the string is Swift interpolation.
      ["interpolated evaluateJavaScript", /\bevaluateJavaScript\s*\(\s*"[^"]*\\\(/]
    ]
  },
  {
    files: /\.go$/,
    calls: [
      [
        "shell command",
        /\bexec\.Command(?:Context)?\s*\((?:[^,"]*,\s*)?"(?:[^"]*\/)?(?:sh|bash|zsh|dash|ksh|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh)"\s*,\s*"(?:-[a-zA-Z]*c|\/[cC]|-Command)"/
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

      const found = matchAddedLines(file.patch, language.calls, language.definitions);
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
          message: `${text} ${plural ? "add" : "adds"} ${many ? "calls that deserve" : "a call that deserves"} a security review: ${kinds.join(", ")}.`,
          recommendation:
            "Check that no user or pull request input reaches these calls, and prefer a safer alternative such as JSON.parse, execFile with an argument list, yaml.safe_load, or textContent."
        }
      ];
    });
  }
};
