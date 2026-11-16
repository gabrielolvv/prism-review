import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";

type Exposure = { line: number; kind: "artifact" | "commands" };

const workflowFile = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const examplePath = /(?:^|[\/_.-])(?:examples?|samples?|demos?|fixtures?|testdata)(?:[\/_.-]|$)/i;

// `uses: actions/checkout@v4`, with the version in the ref or in a comment after a commit hash.
const checkoutStep = /^\s*-?\s*uses:\s*["']?actions\/checkout@([^\s"'#]+)["']?\s*(?:#\s*(\S+))?/i;
const uploadStep = /^\s*-?\s*uses:\s*["']?actions\/upload-artifact@([^\s"'#]+)["']?\s*(?:#\s*(\S+))?/i;
const keepsCredentials = /^\s*persist-credentials:\s*["']?false["']?\s*(?:#.*)?$/i;
const includesHidden = /^\s*include-hidden-files:\s*["']?true["']?\s*(?:#.*)?$/i;
// The whole workspace, which holds `.git/config`.
const workspacePath = /^\s*path:\s*["']?(?:\.\/?|\$\{\{\s*github\.workspace\s*\}\}\/?)["']?\s*(?:#.*)?$/i;
const unsecureCommands = /\bACTIONS_ALLOW_UNSECURE_COMMANDS\b["']?\s*[:=]\s*["']?true\b/i;
const commentLine = /^\s*#/;

// The major and minor version of an action's ref or its trailing comment, such as `v4.3.6`.
function version(ref: string, comment: string | undefined): [number, number] | undefined {
  const match = /^v?(\d+)(?:\.(\d+))?/.exec(/^[0-9a-f]{40}$/i.test(ref) ? (comment ?? "") : ref);
  return match === null ? undefined : [Number(match[1]), Number(match[2] ?? Number.MAX_SAFE_INTEGER)];
}

// The lines of the step that starts at `index`, up to the next step or the end of the steps.
function stepLines(lines: PatchLine[], index: number): PatchLine[] {
  const start = lines[index]?.content ?? "";
  const indent = /^\s*/.exec(start)?.[0].length ?? 0;
  const dash = start.trimStart().startsWith("-") ? indent : indent - 2;
  const step: PatchLine[] = [];
  for (const line of lines.slice(index + 1)) {
    const lineIndent = /^\s*/.exec(line.content)?.[0].length ?? 0;
    if (line.startsHunk || (line.content.trim() !== "" && lineIndent <= dash)) {
      break;
    }
    step.push(line);
  }
  return step;
}

function exposures(lines: PatchLine[]): Exposure[] {
  const found: Exposure[] = [];
  // actions/checkout before v6 saves the token in `.git/config`; later versions keep it outside the
  // workspace.
  const checkoutSavesToken = lines.some(({ content }, index) => {
    const match = checkoutStep.exec(content);
    if (match === null) {
      return false;
    }
    const checkout = version(match[1] ?? "", match[2]);
    return (checkout === undefined || checkout[0] < 6) && !stepLines(lines, index).some(({ content: setting }) => keepsCredentials.test(setting));
  });
  lines.forEach(({ line, content, added }, index) => {
    if (commentLine.test(content)) {
      return;
    }
    const upload = uploadStep.exec(content);
    if (upload !== null && checkoutSavesToken) {
      // upload-artifact leaves out hidden files such as `.git` from v4.4 on, unless told otherwise.
      const step = stepLines(lines, index);
      const uploader = version(upload[1] ?? "", upload[2]);
      const hidden = step.some(({ content: setting }) => includesHidden.test(setting));
      const workspace = step.find(({ content: setting }) => workspacePath.test(setting));
      const oldUploader = uploader !== undefined && (uploader[0] < 4 || (uploader[0] === 4 && uploader[1] < 4));
      if (workspace !== undefined && (hidden || oldUploader) && (added || step.some(({ added: changed }) => changed))) {
        found.push({ line: workspace.line, kind: "artifact" });
      }
      return;
    }
    if (!added) {
      return;
    }
    if (unsecureCommands.test(content)) {
      found.push({ line, kind: "commands" });
    }
  });
  return found;
}

const phrases: Record<Exposure["kind"], string> = {
  artifact:
    "uploads the checked-out workspace as an artifact with the token `actions/checkout` saved in `.git/config`, so anyone who can download the artifact can use the token while the run lasts",
  commands:
    "turns on the deprecated `set-env` and `add-path` commands, so any text a step prints, such as a pull request title or a dependency's output, can set environment variables and the path for every later step"
};

export const workflowCredentialExposureRule: Rule = {
  id: "workflow-credential-exposure",
  description:
    "Flags GitHub Actions workflows that hand out their token: a workspace artifact with the token `actions/checkout` saved, and `ACTIONS_ALLOW_UNSECURE_COMMANDS`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.workflowCredentialExposure.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !workflowFile.test(file.path) ||
        examplePath.test(file.path) ||
        file.patch === undefined ||
        // Workflows kept as test data, such as a scanner's fixtures.
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = exposures(patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text } = describeLines(lineNumbers);
      const kinds = [...new Set(found.map(({ kind }) => kind))];
      return [
        {
          ruleId: "workflow-credential-exposure",
          title: "Workflow hands out its token",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the workflow ${listOf(kinds.map((kind) => phrases[kind]))}.`,
          recommendation:
            "Set `persist-credentials: false` on `actions/checkout`, or use `actions/checkout@v6` or later, and upload only the build output with `actions/upload-artifact@v4` or later. Remove `ACTIONS_ALLOW_UNSECURE_COMMANDS` and write to `$GITHUB_ENV` and `$GITHUB_PATH` instead."
        }
      ];
    });
  }
};
