import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Step = { lines: PatchLine[]; text: string };
type Found = { line: number; runsCode: boolean };

const workflowFile = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const exampleWorkflow = /(?:^|[\/_.-])(?:examples?|samples?|demos?|templates?|fixtures?|testdata)(?:[\/_.-]|$)/i;

const workflowRunTrigger = /^\s*workflow_run\s*:|^\s*on\s*:.*\bworkflow_run\b|^\s*-\s*workflow_run\s*$/m;
const stepStart = /^(\s*)-\s+(?:name|uses|run|id|if|with|env|shell|working-directory|continue-on-error|timeout-minutes)\s*:/;
// Conditions that keep the job to runs from this repository's branches.
const trustedRun =
  /workflow_run\.event\s*==\s*['"](?:push|schedule|release|workflow_dispatch)['"]|workflow_run\.event\s*!=\s*['"]pull_request['"]|workflow_run\.head_repository\.(?:full_name|fork)|workflow_run\.head_repository\.owner/;

// Steps that fetch the triggering run's artifacts.
const downloadArtifact = /\buses\s*:\s*actions\/download-artifact@/;
const runIdFromTrigger = /\brun-id\s*:\s*.*\bworkflow_run\b|\brun-id\s*:\s*\$\{\{\s*github\.event\.workflow_run\.id\s*\}\}/;
const thirdPartyDownload = /\buses\s*:\s*dawidd6\/action-download-artifact@/;
const ghRunDownload = /\bgh\s+run\s+download\b/;
const apiDownload = /\b(?:downloadArtifact|listWorkflowRunArtifacts)\b/;
const unzip = /\bunzip\b(?![^\n]*\s-d\s+(?!\.(?:\/)?(?:\s|["'`)]|$))\S)[^\n]*\.zip\b/;
// Destinations in the workspace: no `path`, `.`, `./`, or the workspace itself.
const pathKey = /^\s*(?:-\s+)?path\s*:\s*(.*)$/m;
const workspacePath = /^(?:["']?\.\/?["']?|["']?\$\{\{\s*github\.workspace\s*\}\}\/?["']?|)\s*(?:#.*)?$/;
const ghRunDir = /\s(?:-D|--dir)\s+(?!\.(?:\/)?(?:\s|$))\S/;

const checkout = /\buses\s*:\s*actions\/checkout@/;
// Later steps that run code from the workspace: local actions, scripts, and build tools.
export const runsWorkspaceCode =
  /\buses\s*:\s*\.\/|\brun\s*:.*(?:\.\/[\w./-]+|\b(?:npm|npx|yarn|pnpm|make|python3?|node|bash|sh|go|mvn|gradle|\.\/gradlew|cargo|bundle|rake|pip)\b)/;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

function stepsIn(lines: PatchLine[]): Step[] {
  const steps: Step[] = [];
  let current: PatchLine[] = [];
  let indent = -1;
  for (const line of lines) {
    const start = stepStart.exec(line.content);
    if (start !== null && (indent < 0 || (start[1] ?? "").length <= indent)) {
      if (current.length > 0) {
        steps.push({ lines: current, text: current.map(({ content }) => content).join("\n") });
      }
      current = [line];
      indent = (start[1] ?? "").length;
      continue;
    }
    if (current.length > 0 && line.content.trim() !== "" && indentOf(line.content) <= indent && !/^\s*#/.test(line.content)) {
      steps.push({ lines: current, text: current.map(({ content }) => content).join("\n") });
      current = [];
      indent = -1;
      continue;
    }
    if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) {
    steps.push({ lines: current, text: current.map(({ content }) => content).join("\n") });
  }
  return steps;
}

// The line of a step that unpacks the triggering run's artifacts into the workspace.
function intoWorkspace(step: Step, usesApi: boolean): PatchLine | undefined {
  const path = pathKey.exec(step.text)?.[1] ?? "";
  if ((downloadArtifact.test(step.text) && runIdFromTrigger.test(step.text)) || thirdPartyDownload.test(step.text)) {
    return workspacePath.test(path.trim()) ? step.lines[0] : undefined;
  }
  const gh = step.lines.find(({ content }) => ghRunDownload.test(content));
  if (gh !== undefined && /workflow_run|RUN_ID|run_id/i.test(step.text) && !ghRunDir.test(step.text)) {
    return gh;
  }
  return usesApi ? step.lines.find(({ content }) => unzip.test(content)) : undefined;
}

export const workflowArtifactPoisoningRule: Rule = {
  id: "workflow-artifact-poisoning",
  description:
    "Flags `workflow_run` workflows that unpack the triggering run's artifacts, which a fork pull request can fill, into the workspace over the checked-out code.",
  run({ files, config }) {
    if (!config.rules.workflowArtifactPoisoning.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !workflowFile.test(file.path) ||
        file.patch === undefined ||
        exampleWorkflow.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }
      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      if (!workflowRunTrigger.test(text) || trustedRun.test(text)) {
        return [];
      }

      const steps = stepsIn(lines);
      const usesApi = apiDownload.test(text);
      const found: Found[] = [];
      steps.forEach((step, index) => {
        const line = intoWorkspace(step, usesApi);
        if (line === undefined || !step.lines.some(({ added }) => added)) {
          return;
        }
        const before = steps.slice(0, index).some(({ text: earlier }) => checkout.test(earlier));
        const after = steps.slice(index + 1);
        const runsCode = after.some(({ text: later }) => runsWorkspaceCode.test(later));
        if (before || runsCode) {
          found.push({ line: line.line, runsCode });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text: where, plural } = describeLines(lineNumbers);
      const runsCode = found.some((entry) => entry.runsCode);
      return [
        {
          ruleId: "workflow-artifact-poisoning",
          title: "Untrusted artifacts unpacked over the workspace",
          severity: runsCode ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "unpack" : "unpacks"} artifacts of the run that triggered this \`workflow_run\` workflow into the workspace. A pull request from a fork can fill those artifacts, and their files can replace the checked-out code${runsCode ? ", which later steps run" : ""} with this workflow's secrets and write token.`,
          recommendation:
            "Download artifacts from pull request runs into a separate directory, such as `path: ${{ runner.temp }}/artifacts` or `unzip -d`, and treat what they hold as untrusted data: check values such as pull request numbers before using them, never run files from them, and never write their contents to `$GITHUB_ENV`. Or limit the job to runs from this repository with `if: github.event.workflow_run.event == 'push'`."
        }
      ];
    });
  }
};
