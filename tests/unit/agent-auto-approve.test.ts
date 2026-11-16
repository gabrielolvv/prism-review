import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { agentAutoApproveRule } from "../../src/rules/agent-auto-approve.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return agentAutoApproveRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testAgentAutoApproveReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added(".claude/settings.json", ["{", "  \"permissions\": {", "    \"defaultMode\": \"bypassPermissions\"", "  }", "}"])]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Coding agent set to act without asking");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 lets Claude Code run commands and change files without asking for everyone who opens this repository with it, so instructions hidden in an issue, a dependency, a web page, or a file the agent reads can run commands on their machines with their credentials."
  );
}

export function testAgentAutoApproveReadsEachAgent(): void {
  const cases: Array<[string, string[], string]> = [
    [".claude/settings.json", ["{", "  \"permissions\": {", "    \"allow\": [", "      \"Read\",", "      \"Bash(*)\"", "    ]", "  }", "}"], "warning"],
    [".claude/settings.json", ["{ \"permissions\": { \"allow\": [\"Edit\", \"Bash\"] } }"], "warning"],
    [".gemini/settings.json", ["{", "  \"general\": { \"approvalMode\": \"yolo\" }", "}"], "high"],
    [".gemini/settings.json", ["{", "  \"tools\": { \"allowed\": [\"run_shell_command\"] }", "}"], "warning"],
    [".codex/config.toml", ["approval_policy = \"never\"", "sandbox_mode = \"danger-full-access\""], "high"],
    [".vscode/settings.json", ["{", "  \"chat.tools.global.autoApprove\": true", "}"], "high"],
    [".vscode/settings.json", ["{", "  \"chat.tools.terminal.autoApprove\": {", "    \"/.*/\": true", "  }", "}"], "warning"],
    [".cursor/cli.json", ["{ \"permissions\": { \"allow\": [\"Shell(*)\"] } }"], "warning"],
    [".aider.conf.yml", ["model: sonnet", "yes-always: true"], "high"]
  ];
  for (const [path, lines, severity] of cases) {
    const [finding, ...rest] = findings([added(path, lines)]);
    assert.equal(rest.length, 0, `${path}: ${lines.join(" | ")}`);
    assert.equal(finding?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testAgentAutoApproveSkipsNarrowPermissions(): void {
  const cases: Array<[string, string[]]> = [
    // Specific commands, deny lists, default modes, and the sandbox left on.
    [".claude/settings.json", ["{ \"permissions\": { \"allow\": [\"Bash(npm test)\", \"Bash(git status:*)\"] } }"]],
    [".claude/settings.json", ["{ \"permissions\": { \"deny\": [\"Bash(*)\"], \"defaultMode\": \"acceptEdits\" } }"]],
    [".gemini/settings.json", ["{ \"tools\": { \"allowed\": [\"run_shell_command(git status)\"] } }"]],
    [".codex/config.toml", ["approval_policy = \"on-request\"", "sandbox_mode = \"workspace-write\""]],
    [".vscode/settings.json", ["{ \"chat.tools.terminal.autoApprove\": { \"npm test\": true, \"/.*/\": false } }"]],
    [".aider.conf.yml", ["yes-always: false"]],
    // Other settings files, and examples.
    [".vscode/settings.json", ["{ \"editor.formatOnSave\": true }"]],
    ["config/settings.json", ["{ \"defaultMode\": \"bypassPermissions\" }"]],
    ["examples/agent/.claude/settings.json", ["{ \"permissions\": { \"defaultMode\": \"bypassPermissions\" } }"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testAgentAutoApproveSkipsExamplesAndCanBeDisabled(): void {
  const lines = ["{ \"permissions\": { \"defaultMode\": \"bypassPermissions\" } }"];
  assert.deepEqual(findings([added("docs/agents/.claude/settings.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { agentAutoApprove: { enabled: false } } });
  assert.deepEqual(findings([added(".claude/settings.json", lines)], config), []);
}
