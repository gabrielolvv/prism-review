import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "share" | "webui" | "origins" | "ollama" | "ray";
type Found = { line: number; kind: Kind; high: boolean };

const sourceFile = /\.(?:py|sh|bash|zsh|ps1|bat|cmd|service|env|ya?ml|json|toml|tf|[cm]?[jt]s)$|(?:^|\/)(?:Dockerfile[^/]*|Containerfile|Makefile|Procfile)$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|html?|ipynb)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ|tests?)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\//i;
const commentLine = /^\s*(?:#|\/\/|\*|::|REM\b)/i;
// Files that start a process on a host rather than in a container, where binding to every interface
// exposes the machine itself: systemd units, shell and PowerShell scripts, and macOS launchctl.
const hostFile = /\.(?:service|sh|bash|zsh|ps1|bat|cmd)$/i;

// Gradio's public share links, from code and from the web UIs built on it.
const launchCall = /\.launch\s*\(/;
const shareArgument = /\bshare\s*=\s*True\b/;
const authArgument = /\bauth\s*=|\bauth_dependency\s*=/;
const shareFlag = /(?:server\.py|webui\.(?:sh|bat|py)|launch\.py|webui-user\.(?:sh|bat)|COMMANDLINE_ARGS|CMD_FLAGS)\b[^\n]*\s--share\b/;
const gradioAuthFlag = /--gradio-auth(?:-path)?\b/;
// Open WebUI with its login turned off, as an assignment or an environment entry.
const webuiAuthOff = /\bWEBUI_AUTH["']?\s*[:=]\s*["']?(?:false|False|FALSE|0)\b|name\s*=\s*["']WEBUI_AUTH["']\s*,\s*value\s*=\s*["'](?:false|False|0)["']/;
const webuiAuthName = /^\s*-?\s*name\s*:\s*["']?WEBUI_AUTH["']?\s*$/;
const falseValue = /^\s*value\s*:\s*["']?(?:false|False|0)["']?\s*$/;
// Ollama answering any website that the user's browser opens.
const ollamaOrigins = /\bOLLAMA_ORIGINS["']?\s*[:=\s]\s*["']?\*/;
// Ollama and Ray's dashboard on every interface of a host.
const ollamaHost = /\bOLLAMA_HOST["']?\s*[:=\s]\s*["']?(?:https?:\/\/)?(?:0\.0\.0\.0|::|\[::\])(?::\d+)?["']?/;
const rayStart = /\bray\s+start\b[^\n]*--dashboard-host[=\s]+["']?0\.0\.0\.0/;
const rayInit = /\bray\.init\s*\(/;
const rayInitDashboard = /\bdashboard_host\s*=\s*["']0\.0\.0\.0["']/;

// Whether a setting appears outside backticks, which descriptions and messages use to quote one.
function sets(pattern: RegExp, content: string): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return [...content.matchAll(global)].some((match) => content[(match.index ?? 0) - 1] !== "`");
}

// A call's text from `start`, over the lines it may span.
function callText(lines: PatchLine[], index: number, start: RegExp): string {
  const call = lines
    .slice(index, index + 8)
    .map(({ content }) => content)
    .join(" ");
  return call.slice(Math.max(0, call.search(start)));
}

function exposures(lines: PatchLine[], host: boolean, python: boolean): Found[] {
  const found: Found[] = [];
  const add = (line: number, kind: Kind, high = false) => found.push({ line, kind, high });
  lines.forEach(({ line, content, added }, index) => {
    if (!added || commentLine.test(content)) {
      return;
    }
    if (python && launchCall.test(content)) {
      const args = callText(lines, index, launchCall);
      if (shareArgument.test(args) && !authArgument.test(args)) {
        add(line, "share");
      }
    }
    // Ray's dashboard: high from a host's units and scripts, a warning from Python, which may run in a
    // container.
    if (host && sets(rayStart, content)) {
      add(line, "ray", true);
    }
    if (python && rayInit.test(content) && rayInitDashboard.test(callText(lines, index, rayInit))) {
      add(line, "ray");
    }
    if (sets(shareFlag, content) && !gradioAuthFlag.test(content)) {
      add(line, "share");
    }
    const next = lines[index + 1]?.content ?? "";
    if (sets(webuiAuthOff, content) || (webuiAuthName.test(content) && falseValue.test(next))) {
      add(line, "webui", true);
    }
    if (sets(ollamaOrigins, content)) {
      add(line, "origins");
    }
    if (host && sets(ollamaHost, content)) {
      add(line, "ollama");
    }
  });
  return found;
}

const phrases: Record<Kind, string> = {
  share: "opens a public Gradio share link, through which anyone with the URL can use the app and the model, files, and tools behind it",
  webui: "turns Open WebUI's login off, so anyone who reaches it can use its models, tools, and stored chats",
  origins: "lets every website call Ollama's API from the user's browser",
  ollama: "listens with Ollama, which has no authentication, on every interface of the machine",
  ray: "opens Ray's dashboard and Jobs API on every interface, which run any code they are sent without authentication, as in the ShadowRay attacks"
};

export const aiServiceExposureRule: Rule = {
  id: "ai-service-exposure",
  description:
    "Flags AI tools opened to others without a login: Gradio share links, Open WebUI with `WEBUI_AUTH` off, Ollama's `OLLAMA_ORIGINS=*`, and Ollama or Ray's dashboard on every interface of a host.",
  run({ files, config }) {
    if (!config.rules.aiServiceExposure.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test setups.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = exposures(patchLines(file.patch), hostFile.test(file.path), /\.py$/i.test(file.path));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text } = describeLines(lineNumbers);
      const kinds = (Object.keys(phrases) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      return [
        {
          ruleId: "ai-service-exposure",
          title: "AI service open without a login",
          severity: found.some(({ high }) => high) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the change ${listOf(kinds.map((kind) => phrases[kind]))}.`,
          recommendation:
            "Keep AI tools on localhost or a private network and put a login in front of them: Gradio's `auth=` or `--gradio-auth`, Open WebUI's own login, or a reverse proxy with authentication for Ollama and Ray. List the origins that may call Ollama instead of `*`, and reach Ray's dashboard through a tunnel or `kubectl port-forward`."
        }
      ];
    });
  }
};
