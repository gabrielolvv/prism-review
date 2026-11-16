import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { localHost } from "./credential-files.js";
import { isSecretValue } from "./deployment-env-secrets.js";

// A risk in an MCP client's server configuration: a token written in it, a server package started
// without a fixed version, or a remote server reached over plain HTTP.
export type McpConfigLine = { line: number; kind: "secret" | "unpinned" | "http"; name: string };

// Files that only MCP clients read, and shared names that need an `mcpServers` or `servers` key.
const mcpOnlyFile =
  /(?:^|\/)(?:\.mcp\.json|claude_desktop_config\.json|cline_mcp_settings\.json|mcp_settings\.json|\.cursor\/mcp\.json|\.vscode\/mcp\.json|\.roo\/mcp\.json|\.amazonq\/mcp\.json|\.kiro\/settings\/mcp\.json|\.windsurf\/mcp_config\.json)$/i;
const mcpNamedFile = /(?:^|\/)(?:mcp|mcp[-_]config|mcp[-_]servers)\.jsonc?$|(?:^|\/)\.gemini\/settings\.json$/i;
const serversKey = /"(?:mcpServers|servers|mcp_servers)"\s*:/;

const entry = /"([\w.-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
// Headers that carry a token, such as `"Authorization": "Bearer ..."`.
const authHeader = /^(?:authorization|proxy-authorization|x-api-key|api-key|x-auth-token|x-access-token)$/i;
const authScheme = /^(?:Bearer|Token|Basic|ApiKey)\s+/i;
// `"--api-key=..."` and `"--token", "..."` in `args`.
const secretFlag = /"--?([\w-]*(?:key|token|secret|password))(?:=|"\s*,\s*")([^"]+)"/gi;
const command = /"command"\s*:\s*"(?:[^"]*\/)?(npx|bunx|pnpm|uvx|docker)(?:\.exe|\.cmd)?"/;
const argsStart = /"args"\s*:\s*\[/;
const argItem = /"((?:[^"\\]|\\.)*)"/g;
const argsWindow = 20;
// Docker flags that take the next item as their value.
const dockerValueFlag = /^(?:-e|--env|-v|--volume|--mount|--name|--network|-p|--publish|-w|--workdir|--env-file|--platform|-u|--user|--entrypoint|-l|--label)$/;
const remoteHttp = /"(?:url|serverUrl|endpoint|baseUrl)"\s*:\s*"http:\/\/([^/:"]+)/;

// Whether an npm package spec names a version, as `pkg@1.2.3` and `@scope/pkg@1.2.3` do, but not
// `pkg@latest`.
function pinnedNpm(spec: string): boolean {
  const version = /^(?:@[^/@]+\/)?[^@]+@(.+)$/.exec(spec)?.[1];
  return version !== undefined && !/^(?:latest|next|beta|canary|\*)$/i.test(version);
}

// The package or image a launcher starts, from its `args`, or undefined for a local path.
function launched(tool: string, args: string[]): { spec: string; pinned: boolean } | undefined {
  const local = (spec: string) => /^(?:\.{0,2}\/|[A-Za-z]:\\|~)|\.(?:js|mjs|cjs|ts|py)$/.test(spec);
  if (tool === "docker") {
    if (!args.includes("run")) {
      return undefined;
    }
    const after = args.slice(args.indexOf("run") + 1);
    const image = after.find((item, index) => !item.startsWith("-") && !dockerValueFlag.test(after[index - 1] ?? "") && /^[a-z0-9][\w.\-/:@]*$/.test(item));
    if (image === undefined) {
      return undefined;
    }
    const pinned = /@sha256:[a-f0-9]{64}$/.test(image) || /:(?!latest$)[\w.-]+$/.test(image.split("/").at(-1) ?? "");
    return { spec: image, pinned };
  }
  const items = tool === "pnpm" ? args.slice(args.indexOf("dlx") + 1) : args;
  if (tool === "pnpm" && !args.includes("dlx")) {
    return undefined;
  }
  const packageFlag = items.findIndex((item) => item === "--package" || item === "-p" || item === "--from");
  const flagged = items.find((item) => /^--(?:package|from)=/.test(item))?.split("=").slice(1).join("=");
  const spec = flagged ?? (packageFlag >= 0 ? items[packageFlag + 1] : items.find((item) => !item.startsWith("-")));
  if (spec === undefined || local(spec)) {
    return undefined;
  }
  const pinned = tool === "uvx" ? /==|@\d/.test(spec) : pinnedNpm(spec);
  return { spec, pinned };
}

function secrets(content: string): string[] {
  const names: string[] = [];
  for (const [, key = "", value = ""] of content.matchAll(entry)) {
    if (authHeader.test(key) ? isSecretValue("token", value.replace(authScheme, "")) : isSecretValue(key, value)) {
      names.push(key);
    }
  }
  for (const [, flag = "", value = ""] of content.matchAll(secretFlag)) {
    if (isSecretValue(flag.replace(/-/g, "_"), value)) {
      names.push(`--${flag}`);
    }
  }
  return names;
}

// The `args` items that follow a launcher command, and the line each is on.
function argsAfter(lines: PatchLine[], index: number): Array<{ item: string; line: PatchLine }> {
  const window = lines.slice(index, index + argsWindow);
  const start = window.findIndex(({ content }) => argsStart.test(content));
  if (start < 0) {
    return [];
  }
  const items: Array<{ item: string; line: PatchLine }> = [];
  for (const line of window.slice(start)) {
    const text = line === window[start] ? line.content.slice(line.content.search(argsStart)).replace(argsStart, "") : line.content;
    const closing = text.indexOf("]");
    for (const [, item = ""] of (closing >= 0 ? text.slice(0, closing) : text).matchAll(argItem)) {
      items.push({ item, line });
    }
    if (closing >= 0) {
      break;
    }
  }
  return items;
}

// Added lines of an MCP client configuration that commit a token, start a server package without a
// fixed version, or reach a remote server over plain HTTP. Runs before redaction, which hides tokens.
export function findMcpConfigLines(path: string, patch: string): McpConfigLine[] {
  const named = mcpNamedFile.test(path);
  if (!mcpOnlyFile.test(path) && !named) {
    return [];
  }
  const lines = patchLines(patch);
  if (named && !lines.some(({ content }) => serversKey.test(content))) {
    return [];
  }
  const found: McpConfigLine[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (/^\s*\/\//.test(content)) {
      return;
    }
    if (added) {
      for (const name of secrets(content)) {
        found.push({ line, kind: "secret", name });
      }
      const http = remoteHttp.exec(content);
      if (http !== null && !localHost.test(http[1] ?? "") && !/\.(?:local|localhost|internal)$/i.test(http[1] ?? "")) {
        found.push({ line, kind: "http", name: http[1] ?? "" });
      }
    }
    const launcher = command.exec(content);
    if (launcher === null) {
      return;
    }
    const args = argsAfter(lines, index);
    const started = launched(launcher[1] ?? "", args.map(({ item }) => item));
    const specLine = args.find(({ item }) => item === started?.spec)?.line;
    if (started !== undefined && !started.pinned && (added || specLine?.added === true)) {
      found.push({ line: specLine?.line ?? line, kind: "unpinned", name: started.spec });
    }
  });
  return found;
}
