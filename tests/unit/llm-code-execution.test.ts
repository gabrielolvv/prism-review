import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { llmCodeExecutionRule } from "../../src/rules/llm-code-execution.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return llmCodeExecutionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testLlmCodeExecutionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/agents/analyst.py", [
      "from langchain_experimental.agents import create_pandas_dataframe_agent",
      "",
      "agent = create_pandas_dataframe_agent(llm, df, verbose=True, allow_dangerous_code=True)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "LLM agent runs generated code on the host");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 lets a LangChain agent run the code or commands the model writes directly on this host, so anyone who can put text in front of the model, through a chat message, a document, a web page, or a tool result, can make it run their own commands with this process's files, network access, and credentials."
  );
}

export function testLlmCodeExecutionReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["app/tools.py", ["tools = load_tools([\"terminal\"], allow_dangerous_tools=True)"]],
    ["app/tools.py", ["tools = [PythonREPLTool(), search]"]],
    ["app/tools.py", ["shell = ShellTool()"]],
    ["app/team.py", ["coder = UserProxyAgent(", "    \"coder\",", "    code_execution_config={\"work_dir\": \"coding\", \"use_docker\": False},", ")"]],
    ["app/team.py", ["executor = LocalCommandLineCodeExecutor(work_dir=\"coding\")"]],
    ["app/team.py", ["reply = execute_code(code, timeout=60, use_docker=False)"]],
    ["app/agent.py", ["agent.register_tool(ShellTool())"]],
    ["app/crew.py", ["coder = Agent(role=\"Coder\", allow_code_execution=True, code_execution_mode=\"unsafe\")"]],
    ["config/agents.yaml", ["coder:", "  allow_code_execution: true", "  code_execution_mode: unsafe"]],
    ["app/agent.py", ["agent = CodeAgent(tools=[], model=model, additional_authorized_imports=[\"*\"])"]],
    ["app/assistant.py", ["interpreter.auto_run = True"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testLlmCodeExecutionSkipsSandboxedAgents(): void {
  const cases: Array<[string, string[]]> = [
    // Switches left off, and code run in Docker or a remote sandbox.
    ["app/agents/analyst.py", ["agent = create_pandas_dataframe_agent(llm, df, allow_dangerous_code=False)"]],
    ["app/team.py", ["code_execution_config={\"work_dir\": \"coding\", \"use_docker\": True}"]],
    ["app/team.py", ["executor = DockerCommandLineCodeExecutor(image=\"python:3.12-slim\")"]],
    ["app/crew.py", ["coder = Agent(role=\"Coder\", allow_code_execution=True, code_execution_mode=\"safe\")"]],
    ["app/agent.py", ["agent = CodeAgent(tools=[], model=model, additional_authorized_imports=[\"pandas\", \"numpy\"])"]],
    ["app/agent.py", ["agent = CodeAgent(tools=[], model=model, executor_type=\"e2b\")"]],
    ["app/assistant.py", ["interpreter.auto_run = False"]],
    ["app/agent.py", ["agent.register_tool(ShellTool(environment=ContainerAutoEnvironment()))"]],
    // A variable that a framework reads from the environment.
    ["app/team.py", ["        use_docker = False"]],
    // Imports, class definitions, annotations, comments, and docstrings.
    ["app/tools.py", ["from langchain_experimental.tools import PythonREPLTool"]],
    ["app/tools.py", ["class SafeShellTool(ShellTool):"]],
    ["app/tools.py", ["def run(tool: PythonREPLTool) -> str:"]],
    ["app/tools.py", ["# agent = create_pandas_dataframe_agent(llm, df, allow_dangerous_code=True)"]],
    ["app/tools.py", ["def build():", "    \"\"\"Build the agent.", "", "    >>> create_pandas_dataframe_agent(llm, df, allow_dangerous_code=True)", "    \"\"\"", "    return None"]],
    // Error messages that name a switch.
    ["app/agents/analyst.py", ["raise ValueError(\"This agent runs Python. Opt in with allow_dangerous_code=True.\")"]],
    ["app/agents/analyst.py", ["    \"This agent can run shell commands. Opt in \"", "    \"by setting allow_dangerous_tools=True.\""]],
    ["app/team.py", ["log.warning(f\"'{name}' runs code with use_docker=False\")"]],
    ["app/agents/analyst.py", ["log.warning(\"This agent runs Python. \\", "    Opt in with allow_dangerous_code=True.\")"]],
    // Examples, notebooks, and documentation.
    ["examples/pandas_agent.py", ["agent = create_pandas_dataframe_agent(llm, df, allow_dangerous_code=True)"]],
    ["notebooks/pandas.ipynb", ["    \"agent = create_pandas_dataframe_agent(llm, df, allow_dangerous_code=True)\""]],
    ["docs/agents.md", ["agent = create_pandas_dataframe_agent(llm, df, allow_dangerous_code=True)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testLlmCodeExecutionSkipsTestsAndCanBeDisabled(): void {
  const lines = ["tools = [PythonREPLTool()]"];
  assert.deepEqual(findings([added("tests/test_agent.py", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { llmCodeExecution: { enabled: false } } });
  assert.deepEqual(findings([added("app/tools.py", lines)], config), []);
}
