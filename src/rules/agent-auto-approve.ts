import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Grant = { line: number; scope: "everything" | "shell" };
type Tool = { name: string; files: RegExp; grants: (lines: PatchLine[]) => Grant[] };

const examplePath = /(?:^|[\/_.-])(?:examples?|samples?|demos?|fixtures?|testdata|templates?)(?:[\/_.-]|$)|(?:^|\/)docs?\//i;

// The entries of a JSON permission list such as `"allow": [ ... ]`, with their lines.
function listEntries(lines: PatchLine[], key: RegExp): Array<{ entry: string; line: PatchLine }> {
  const entries: Array<{ entry: string; line: PatchLine }> = [];
  let open = false;
  for (const line of lines) {
    if (line.startsHunk) {
      open = false;
    }
    let text = line.content;
    const start = key.exec(text);
    if (start !== null) {
      open = true;
      text = text.slice(start.index + start[0].length);
    }
    if (!open) {
      continue;
    }
    const close = text.indexOf("]");
    for (const [, entry = ""] of (close >= 0 ? text.slice(0, close) : text).matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      entries.push({ entry, line });
    }
    if (close >= 0) {
      open = false;
    }
  }
  return entries;
}

function matching(lines: PatchLine[], pattern: RegExp, scope: Grant["scope"]): Grant[] {
  return lines.filter(({ content, added }) => added && pattern.test(content) && !/^\s*(?:\/\/|#)/.test(content)).map(({ line }) => ({ line, scope }));
}

function shellEntries(lines: PatchLine[], key: RegExp, shell: RegExp): Grant[] {
  return listEntries(lines, key)
    .filter(({ entry, line }) => line.added && shell.test(entry))
    .map(({ line }) => ({ line: line.line, scope: "shell" as const }));
}

const tools: Tool[] = [
  {
    // Claude Code's project settings: the permission mode, and `Bash` or `Bash(*)` in `allow`.
    name: "Claude Code",
    files: /(?:^|\/)\.claude\/settings(?:\.local)?\.json$/i,
    grants: (lines) => [
      ...matching(lines, /"defaultMode"\s*:\s*"bypassPermissions"/, "everything"),
      ...shellEntries(lines, /"allow"\s*:\s*\[/, /^Bash(?:\((?:\*|:\*|\*\*|\* ?)\))?$/)
    ]
  },
  {
    // Gemini CLI's YOLO approval mode, and `run_shell_command` with no command in `tools.allowed`.
    name: "Gemini CLI",
    files: /(?:^|\/)\.gemini\/settings\.json$/i,
    grants: (lines) => [
      ...matching(lines, /"(?:approvalMode|approval-mode)"\s*:\s*"yolo"/i, "everything"),
      ...shellEntries(lines, /"(?:allowed|autoApprove)"\s*:\s*\[/, /^run_shell_command$/)
    ]
  },
  {
    // Codex's sandbox turned off.
    name: "Codex",
    files: /(?:^|\/)\.codex\/config\.toml$/i,
    grants: (lines) => matching(lines, /^\s*sandbox_mode\s*=\s*["']danger-full-access["']/, "everything")
  },
  {
    // VS Code's agent mode approving every tool, or every terminal command.
    name: "VS Code",
    files: /(?:^|\/)\.vscode\/settings\.json$|\.code-workspace$/i,
    grants: (lines) => [
      ...matching(lines, /"chat\.tools\.(?:global\.)?autoApprove"\s*:\s*true/, "everything"),
      ...matching(lines, /"\/\.\*\/[a-z]*"\s*:\s*(?:true|\{\s*"approve"\s*:\s*true)/, "shell")
    ]
  },
  {
    // Cursor's CLI permissions.
    name: "Cursor",
    files: /(?:^|\/)\.cursor\/cli(?:-config)?\.json$/i,
    grants: (lines) => shellEntries(lines, /"allow"\s*:\s*\[/, /^Shell\((?:\*|\*\*)\)$/)
  },
  {
    // Aider's confirmation of every question, including shell commands it suggests.
    name: "Aider",
    files: /(?:^|\/)\.aider\.conf\.ya?ml$/i,
    grants: (lines) => matching(lines, /^\s*yes-always\s*:\s*true\b/, "everything")
  }
];

export const agentAutoApproveRule: Rule = {
  id: "agent-auto-approve",
  description:
    "Flags coding agent settings committed to the repository that let the agent run commands without asking, such as Claude Code's `bypassPermissions`, Gemini CLI's YOLO mode, and Codex's `danger-full-access`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.agentAutoApprove.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const tool = tools.find(({ files: pattern }) => pattern.test(file.path));
      if (
        tool === undefined ||
        file.patch === undefined ||
        examplePath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = tool.grants(patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lineNumbers);
      const everything = found.some(({ scope }) => scope === "everything");
      return [
        {
          ruleId: "agent-auto-approve",
          title: "Coding agent set to act without asking",
          severity: everything ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} ${tool.name} ${everything ? "run commands and change files" : "run any shell command"} without asking for everyone who opens this repository with it, so instructions hidden in an issue, a dependency, a web page, or a file the agent reads can run commands on their machines with their credentials.`,
          recommendation:
            "Keep the agent asking before it runs commands: leave permission modes at their defaults, allow only specific commands, such as `Bash(npm test)` or `run_shell_command(git status)`, and keep Codex's sandbox on. Put broader settings in each developer's personal, uncommitted settings, such as `.claude/settings.local.json` listed in `.gitignore`, or use them only in throwaway containers."
        }
      ];
    });
  }
};
