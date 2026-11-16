import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { mcpServerConfigRule } from "../../src/rules/mcp-server-config.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return mcpServerConfigRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const server = (...body: string[]) => ["{", "  \"mcpServers\": {", "    \"github\": {", ...body, "    }", "  }", "}"];

export function testMcpServerConfigReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(
      ".mcp.json",
      server(
        "      \"command\": \"npx\",",
        "      \"args\": [\"-y\", \"@modelcontextprotocol/server-github@2025.4.8\"],",
        "      \"env\": { \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"Tr0ub4dor-staging\" }"
      )
    )
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "MCP server configuration exposes tokens or runs unpinned code");
  assert.deepEqual(finding?.lines, [6]);
  assert.equal(
    finding?.message,
    "In line 6, the MCP configuration writes `GITHUB_PERSONAL_ACCESS_TOKEN` in plain text, so the token is committed to the repository, where anyone who can read it, a fork, or its history can use it."
  );
  assert.doesNotMatch(finding?.message ?? "", /Tr0ub4dor/);
}

export function testMcpServerConfigReadsEachRisk(): void {
  const cases: Array<[string, string[], string]> = [
    [".mcp.json", server("      \"command\": \"npx\",", "      \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"]"), "warning"],
    [".cursor/mcp.json", server("      \"command\": \"npx\",", "      \"args\": [", "        \"-y\",", "        \"some-mcp-server@latest\"", "      ]"), "warning"],
    ["claude_desktop_config.json", server("      \"command\": \"uvx\",", "      \"args\": [\"mcp-server-fetch\"]"), "warning"],
    [".vscode/mcp.json", ["{", "  \"servers\": {", "    \"github\": {", "      \"command\": \"docker\",", "      \"args\": [\"run\", \"-i\", \"--rm\", \"-e\", \"GITHUB_TOKEN\", \"ghcr.io/github/github-mcp-server\"]", "    }", "  }", "}"], "warning"],
    [".mcp.json", server("      \"type\": \"http\",", "      \"url\": \"http://mcp.acme.io/mcp\""), "warning"],
    [".mcp.json", server("      \"url\": \"https://mcp.acme.io/mcp\",", "      \"headers\": { \"Authorization\": \"Bearer Tr0ub4dor-staging\" }"), "high"],
    [".mcp.json", server("      \"command\": \"node\",", "      \"args\": [\"server.js\", \"--api-key=Tr0ub4dor-staging\"]"), "high"],
    ["config/mcp.json", server("      \"command\": \"npx\",", "      \"args\": [\"-y\", \"@acme/mcp-server\"]"), "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const [finding, ...rest] = findings([added(path, lines)]);
    assert.equal(rest.length, 0, `${path}: ${lines.join(" | ")}`);
    assert.equal(finding?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testMcpServerConfigSkipsSafeConfigs(): void {
  const cases: Array<[string, string[]]> = [
    // Tokens read from the environment or the client's prompts, pinned packages and images, and HTTPS.
    [".mcp.json", server("      \"command\": \"npx\",", "      \"args\": [\"-y\", \"@modelcontextprotocol/server-github@2025.4.8\"],", "      \"env\": { \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"${GITHUB_TOKEN}\" }")],
    [".vscode/mcp.json", ["{", "  \"servers\": {", "    \"github\": {", "      \"command\": \"docker\",", "      \"args\": [\"run\", \"-i\", \"--rm\", \"ghcr.io/github/github-mcp-server:v0.9.1\"],", "      \"env\": { \"GITHUB_TOKEN\": \"${input:github_token}\" }", "    }", "  }", "}"]],
    ["claude_desktop_config.json", server("      \"command\": \"uvx\",", "      \"args\": [\"mcp-server-fetch==2025.1.17\"]")],
    [".mcp.json", server("      \"url\": \"https://mcp.acme.io/mcp\"")],
    [".mcp.json", server("      \"url\": \"http://localhost:3000/mcp\"")],
    // Local servers, placeholders, and other JSON files.
    [".mcp.json", server("      \"command\": \"node\",", "      \"args\": [\"./build/index.js\"]")],
    [".mcp.json", server("      \"command\": \"npx\",", "      \"args\": [\"-y\", \"@acme/mcp-server@1.4.2\"],", "      \"env\": { \"ACME_API_KEY\": \"<your-api-key>\" }")],
    ["package.json", ["{", "  \"scripts\": { \"start\": \"npx -y some-tool\" }", "}"]],
    ["config/mcp.json", ["{", "  \"name\": \"acme\",", "  \"command\": \"npx\",", "  \"args\": [\"-y\", \"some-tool\"]", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testMcpServerConfigFindsTokensBeforeRedaction(): void {
  // Redaction replaces long token-like values, so the tokens are read first.
  const token = "Tr0ub4dorStagingTr0ub4dorStagingTr0ub4dorStaging42";
  const files = prepareChangedFiles([added(".mcp.json", server("      \"command\": \"node\",", "      \"args\": [\"server.js\"],", `      "env": { "ACME_API_TOKEN": "${token}" }`))], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "mcp-server-config");

  assert.doesNotMatch(files[0]?.patch ?? "", new RegExp(token));
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [6]);
  assert.equal(finding?.severity, "high");
}

export function testMcpServerConfigSkipsExamplesAndCanBeDisabled(): void {
  const lines = server("      \"command\": \"npx\",", "      \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"]");
  assert.deepEqual(findings([added("examples/claude/.mcp.json", lines)]), []);
  assert.deepEqual(findings([added("docs/clients/.cursor/mcp.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { mcpServerConfig: { enabled: false } } });
  assert.deepEqual(findings([added(".mcp.json", lines)], config), []);
}
