import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findMcpConfigLines, type McpConfigLine } from "../security/mcp-config.js";
import { describeLines, listOf } from "./line-list.js";

// Example, sample, demo, and fixture configurations.
const examplePath = /(?:^|[\/_.-])(?:examples?|samples?|demos?|fixtures?|testdata|mocks?)(?:[\/_.-]|$)|(?:^|\/)docs?\//i;
const maxNames = 3;

function named(found: McpConfigLine[], kind: McpConfigLine["kind"]): string {
  const names = [...new Set(found.filter((item) => item.kind === kind).map(({ name }) => `\`${name}\``))];
  return listOf(names.length > maxNames ? [...names.slice(0, maxNames), `${names.length - maxNames} more`] : names);
}

export const mcpServerConfigRule: Rule = {
  id: "mcp-server-config",
  description:
    "Flags MCP client configurations that commit a token, start a server package without a fixed version, or reach a remote server over plain HTTP.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.mcpServerConfig.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (examplePath.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const found = configLines(file);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text } = describeLines(lineNumbers);
      const kinds = new Set(found.map(({ kind }) => kind));
      const phrases = [
        ...(kinds.has("secret")
          ? [`writes ${named(found, "secret")} in plain text, so the token is committed to the repository, where anyone who can read it, a fork, or its history can use it`]
          : []),
        ...(kinds.has("unpinned")
          ? [`starts ${named(found, "unpinned")} without a fixed version, so every start runs whatever was published last, with the tokens, files, and tools the server is given`]
          : []),
        ...(kinds.has("http")
          ? [`reaches ${named(found, "http")} over plain HTTP, so anyone on the network can read the requests and change the tool results the model acts on`]
          : [])
      ];
      return [
        {
          ruleId: "mcp-server-config",
          title: "MCP server configuration exposes tokens or runs unpinned code",
          severity: kinds.has("secret") ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the MCP configuration ${listOf(phrases)}.`,
          recommendation:
            "Read tokens from the environment or the client's prompts, such as `${env:GITHUB_TOKEN}` or VS Code's `${input:github-token}`, and rotate any token that was committed. Pin server packages and images to a version or digest, such as `@modelcontextprotocol/server-github@2025.4.8` or `image@sha256:...`, and reach remote servers over HTTPS."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function configLines(file: ChangedFile): McpConfigLine[] {
  if (file.mcpConfigLines !== undefined) {
    return file.mcpConfigLines;
  }
  return file.patch === undefined ? [] : findMcpConfigLines(file.path, file.patch);
}
