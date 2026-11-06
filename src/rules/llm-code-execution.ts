import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; files: RegExp; pattern: RegExp };

const python = /\.py$/i;

const settings: Setting[] = [
  // LangChain's switches for agents that run Python, pandas code, or shell commands.
  { label: "a LangChain agent", files: python, pattern: /\ballow_dangerous_(?:code|tools)\s*=\s*True\b/ },
  // Python and shell tools that run what they are given, from LangChain, AG2, and other frameworks.
  { label: "an agent's Python or shell tool", files: python, pattern: /(?<![\w.])(?:PythonREPLTool|PythonAstREPLTool|PythonREPL|ShellTool|BashProcess)\s*\(/ },
  // AutoGen's code execution outside Docker, as a setting or an argument, and its executor that runs
  // code on the host. A plain `use_docker = False` assignment is a variable, not a setting.
  {
    label: "an AutoGen agent",
    files: python,
    pattern: /["']use_docker["']\s*:\s*False\b|(?:[(,]\s*|^\s*)use_docker\s*=\s*False\s*[,)]|(?<![\w.])LocalCommandLineCodeExecutor\s*\(/
  },
  // CrewAI's code execution outside Docker.
  { label: "a CrewAI agent", files: /\.(?:py|ya?ml)$/i, pattern: /\bcode_execution_mode["']?\s*[=:]\s*["']?unsafe\b/ },
  // smolagents' generated code allowed to import any module, such as `os` and `subprocess`.
  { label: "a smolagents agent", files: python, pattern: /\badditional_authorized_imports\s*=\s*\[\s*["']\*["']\s*\]/ },
  // Open Interpreter running code without asking first.
  { label: "Open Interpreter", files: python, pattern: /\binterpreter\.auto_run\s*=\s*True\b|\bOpenInterpreter\s*\([^)]*\bauto_run\s*=\s*True\b/ }
];

const commentLine = /^\s*(?:#|\/\/)/;
// Tools given a container or remote sandbox to run in, such as AG2's `ShellTool(environment=...)`.
const sandboxed = /\b(?:Docker|Container|Sandbox|E2B|Modal|Daytona)\w*\s*\(|\bexecutor_type\s*=\s*["'](?:docker|e2b|modal)["']/i;
// Class and function definitions, imports, and type annotations name the tools without creating them.
const definition = /^\s*(?:class|def|async\s+def|from|import)\b/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?|ipynb)$/i;
const maxLineLength = 1_000;

// The quote of the string open at `index`, if any. `open` is the quote of a string that the previous
// line continued with a trailing backslash.
function quoteAt(content: string, index: number, open?: string): string | undefined {
  let quote = open;
  for (let position = 0; position < index; position += 1) {
    const character = content[position];
    if (quote !== undefined && character === "\\") {
      position += 1;
    } else if (quote === undefined && (character === '"' || character === "'")) {
      quote = character;
    } else if (character === quote) {
      quote = undefined;
    }
  }
  return quote;
}

// Whether `index` falls inside a quoted string that opens earlier on the line, or on the previous
// line when `open` is set. A line that starts inside a string, such as the second line of a long
// message, has an odd quote before the switch.
export function insideString(content: string, index: number, open?: string): boolean {
  return quoteAt(content, index, open) !== undefined;
}

// The quote of a string that a line continues onto the next one with a trailing backslash.
export function continuedQuote(content: string, open?: string): string | undefined {
  const trimmed = content.trimEnd();
  return trimmed.endsWith("\\") ? quoteAt(trimmed, trimmed.length - 1, open) : undefined;
}

export const llmCodeExecutionRule: Rule = {
  id: "llm-code-execution",
  description: "Flags LLM agents set up to run the code or commands the model writes on the host, such as LangChain's `allow_dangerous_code=True` and AutoGen's `use_docker: False`.",
  run({ files, config }) {
    if (!config.rules.llmCodeExecution.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test code.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const isPython = python.test(file.path);
      const found: Array<{ line: number; label: string }> = [];
      // Python docstrings hold usage examples, as LangChain's and AutoGen's do.
      let inDocstring = false;
      // The quote of a string the previous line continued with a trailing backslash.
      let openQuote: string | undefined;
      patchLines(file.patch).forEach(({ line, content, added, startsHunk }) => {
        if (startsHunk) {
          inDocstring = false;
          openQuote = undefined;
        }
        const wasInDocstring = inDocstring;
        const startQuote = openQuote;
        if (isPython && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        openQuote = isPython && !inDocstring ? continuedQuote(content, startQuote) : undefined;
        if (wasInDocstring || !added || content.length > maxLineLength || commentLine.test(content) || definition.test(content) || sandboxed.test(content)) {
          return;
        }
        // Error messages and help text that name a switch, such as "set allow_dangerous_code=True", do not set it.
        const setting = fileSettings.find(({ pattern }) => {
          const match = pattern.exec(content);
          return match !== null && !insideString(content, match.index, startQuote);
        });
        if (setting !== undefined) {
          found.push({ line, label: setting.label });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "llm-code-execution",
          title: "LLM agent runs generated code on the host",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} ${listOf(labels)} run the code or commands the model writes directly on this host, so anyone who can put text in front of the model, through a chat message, a document, a web page, or a tool result, can make it run their own commands with this process's files, network access, and credentials.`,
          recommendation:
            "Run generated code in a sandbox with no credentials and limited network access, such as AutoGen's `DockerCommandLineCodeExecutor`, CrewAI's default `safe` mode, or smolagents' `executor_type=\"docker\"` or `\"e2b\"`. Keep smolagents' `additional_authorized_imports` to the modules the task needs, ask a person to approve each command before it runs, and keep untrusted documents and web pages away from agents that can run code."
        }
      ];
    });
  }
};
