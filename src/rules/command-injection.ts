import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { servletValue, splitArguments } from "./template-injection.js";
import { railsParams, requestValue } from "./untrusted-input.js";

// Calls that run a command. `command` says which arguments it reads from: the first, which a shell
// parses or which names the program, or every argument, for calls that join them into one command.
// `shell` marks calls that only reach a shell when an option says so, as in Python's
// `subprocess.run(..., shell=True)`; without it, only the program the first argument names counts.
type Sink = { label: string; files: RegExp; call: RegExp; command: "first" | "all"; shell?: RegExp };

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const python = /\.py$/i;
const ruby = /\.(?:rb|erb|rake)$/i;
const php = /\.php$/i;
const java = /\.(?:java|kt)$/i;

const sinks: Sink[] = [
  {
    label: "child_process",
    files: javascript,
    call: /(?:(?<![\w$.])|\b(?:child_process|childProcess|cp|shell)\.)(?:exec|execSync|execaCommand|execaCommandSync|spawn|spawnSync|execFile|execFileSync|execa|execaSync)\s*\(/g,
    command: "first"
  },
  { label: "os.system", files: python, call: /\b(?:os\.(?:system|popen)|commands\.getoutput|subprocess\.(?:getoutput|getstatusoutput))\s*\(/g, command: "first" },
  { label: "subprocess", files: python, call: /\bsubprocess\.(?:run|call|check_call|check_output|Popen)\s*\(/g, command: "first", shell: /\bshell\s*=\s*True\b/ },
  { label: "system", files: ruby, call: /(?:(?<![\w.:])|\b(?:Kernel|Process|IO|Open3)\.)(?:system|exec|spawn|popen|capture2e?|capture3|popen2e?|popen3|pipeline\w*)\s*\(?/g, command: "first" },
  { label: "exec", files: php, call: /(?<![\w>:$])(?:exec|shell_exec|system|passthru|popen|proc_open|pcntl_exec)\s*\(/g, command: "first" },
  { label: "Runtime.exec", files: java, call: /\.exec\s*\(|\bnew\s+ProcessBuilder\s*\(|\bProcessBuilder\s*\(/g, command: "all" },
  { label: "exec.Command", files: /\.go$/i, call: /\bexec\.Command(?:Context)?\s*\(/g, command: "first" },
  { label: "Process.Start", files: /\.cs$/i, call: /\bProcess\.Start\s*\(|\bArguments\s*=\s*/g, command: "all" }
];

// Go's `exec.Command("sh", "-c", script)` hands its third argument to a shell.
const goShell = /^\s*"(?:[^"]*\/)?(?:sh|bash|zsh|dash|ksh|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh)"\s*$/;
// Ruby's backticks and `%x(...)`, and PHP's backticks, run their text in a shell.
const rubyBackticks = /`([^`]*)`|%x[({[]([^)}\]]*)[)}\]]/g;
const phpBackticks = /`([^`]*)`/g;

// Quoting for a shell, or a value turned into a number first.
const escaped =
  /\b(?:shlex|pipes)\.quote\s*\(|\bescapeshell(?:arg|cmd)\s*\(|\bShellwords\.(?:escape|shellescape|join)\b|\.shellescape\b|\bshell(?:_?[eE]scape|Quote|_quote)\s*\(|\bquote\s*\(\s*\[|\b(?:int|float|parseInt|parseFloat|Number|intval|floatval)\s*\(|\.to_[if]\b|\(int\)|\bInteger\.parseInt\s*\(|\bstrconv\.Atoi\s*\(/;

const assignment = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]?]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
// How far, in lines, a name assigned from the request is followed.
const reach = 30;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const commandInjectionRule: Rule = {
  id: "command-injection",
  description: "Flags commands run with a value from the request in the program or the text a shell parses.",
  run({ files, config }) {
    if (!config.rules.commandInjection.enabled) {
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

      const lines = findCommands(file.patch, file.path, fileSinks);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "command-injection",
          title: "Command built from request input",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "run commands" : "runs a command"} with a value from the request in the program or the text a shell parses, so a request can add \`; rm -rf /\`, \`$(curl ...)\`, or another program and run it on the server.`,
          recommendation:
            "Run a fixed program with the request value as a separate argument and no shell, such as `execFile(\"git\", [\"log\", ref])`, `subprocess.run([\"git\", \"log\", ref])`, or `system(\"git\", \"log\", ref)`, and check the value against the forms it may take. Where a shell is unavoidable, quote the value with `shlex.quote`, `escapeshellarg`, or `Shellwords.escape`."
        }
      ];
    });
  }
};

function findCommands(patch: string, path: string, fileSinks: Sink[]): number[] {
  const isRuby = ruby.test(path);
  const isJava = java.test(path);
  const isPhp = php.test(path);
  const fromRequest = (text: string) =>
    requestValue.test(text) || (isRuby && railsParams.test(text)) || (isJava && servletValue.test(text));
  // Names assigned from the request, with the line they were assigned on.
  const tainted = new Map<string, number>();
  const found: number[] = [];

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const isTainted = (text: string) =>
      !escaped.test(text) &&
      (fromRequest(text) ||
        [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`).test(text)));

    if (added) {
      const reported =
        fileSinks.some((sink) => [...content.matchAll(sink.call)].some((match) => runsTainted(content, match, sink, isTainted))) ||
        (isRuby && [...content.matchAll(rubyBackticks)].some((match) => /#\{/.test(match[1] ?? match[2] ?? "") && isTainted(match[1] ?? match[2] ?? ""))) ||
        (isPhp && [...content.matchAll(phpBackticks)].some((match) => isTainted(match[1] ?? "")));
      if (reported) {
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
    const single = assignment.exec(content);
    if (single !== null && single[1] !== undefined) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
  }
  return [...new Set(found)];
}

function runsTainted(content: string, match: RegExpMatchArray, sink: Sink, isTainted: (text: string) => boolean): boolean {
  const rest = content.slice((match.index ?? 0) + match[0].length);
  const args = splitArguments(rest);
  if (sink.command === "all") {
    return isTainted(args.join(","));
  }
  const first = args[0] ?? "";
  // Go: `exec.Command("sh", "-c", script)` runs its third argument in a shell.
  if (sink.label === "exec.Command" && goShell.test(first)) {
    return args.slice(2).some(isTainted);
  }
  // Without a shell, a list of arguments only lets the request choose arguments, not commands.
  if (sink.shell !== undefined && !sink.shell.test(rest)) {
    return !/^\s*\[/.test(first) && isTainted(first);
  }
  return isTainted(first);
}
