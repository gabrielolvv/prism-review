import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type System = "Azure Pipelines" | "Jenkins" | "Drone or Woodpecker" | "CircleCI";

// Values a pull request's author chooses, such as a commit message, a branch name, or a title, as
// each CI system pastes them into a pipeline's text before its shell runs it. GitHub Actions'
// `${{ }}` expressions are left to `workflow-risk`.
const azureMacro =
  /\$\((?:Build\.SourceVersionMessage|System\.PullRequest\.SourceBranch|Build\.RequestedFor(?:Email)?)\)|\$\{\{\s*variables(?:\[\s*'(?:Build\.SourceVersionMessage|System\.PullRequest\.SourceBranch|Build\.RequestedFor(?:Email)?)'\s*\]|\.(?:Build\.SourceVersionMessage|System\.PullRequest\.SourceBranch))\s*\}\}/;
const jenkinsVariable =
  /(?<!\\)\$\{?\s*(?:env\.)?(?:CHANGE_TITLE|CHANGE_BRANCH|CHANGE_AUTHOR(?:_DISPLAY_NAME|_EMAIL)?|ghprbPullTitle|ghprbPullDescription|ghprbPullLongDescription|ghprbSourceBranch|ghprbCommentBody|gitlabMergeRequestTitle|gitlabMergeRequestDescription|gitlabSourceBranch|gitlabUserName)\b/;
// Drone and Woodpecker substitute `${VAR}`, but not `$VAR` or the escaped `$${VAR}`.
const droneVariable =
  /(?<!\$)\$\{(?:DRONE_COMMIT_MESSAGE|DRONE_PULL_REQUEST_TITLE|DRONE_SOURCE_BRANCH|DRONE_COMMIT_BRANCH|DRONE_BRANCH|DRONE_COMMIT_AUTHOR(?:_NAME|_EMAIL)?|CI_COMMIT_MESSAGE|CI_COMMIT_PULL_REQUEST_TITLE|CI_COMMIT_SOURCE_BRANCH|CI_COMMIT_BRANCH|CI_COMMIT_AUTHOR(?:_EMAIL)?)\b[^}]*\}/;
const circleParameter = /<<\s*pipeline\.(?:trigger_parameters\.[\w.]*(?:commit_message|branch|title|head_ref|ref)\w*|git\.commit\.(?:subject|body))\s*>>/;

const azureFile = /(?:^|\/)azure-pipelines[^/]*\.ya?ml$|(?:^|\/)\.(?:azure-pipelines|azuredevops)\/.*\.ya?ml$|(?:^|\/)(?:eng\/)?pipelines\/.*\.ya?ml$/i;
const jenkinsFile = /(?:^|\/)Jenkinsfile[^/]*$|\.jenkinsfile$|(?:^|\/)vars\/[^/]+\.groovy$/i;
const droneFile = /(?:^|\/)\.(?:drone|woodpecker)\.ya?ml$|(?:^|\/)\.(?:drone|woodpecker)\/.*\.ya?ml$/i;
const circleFile = /(?:^|\/)\.circleci\/.*\.ya?ml$/i;

// YAML keys whose value a shell runs.
const scriptKey = /^(\s*)-?\s*(?:script|bash|pwsh|powershell|inlineScript|commands?|run|cmd|entrypoint)\s*:\s*(.*)$/;
// Jenkins steps that pass a Groovy string to a shell.
const jenkinsShellString = /\b(?:sh|bat|powershell|pwsh)\s*\(?\s*(?:script\s*:\s*)?(?:"""|")/;
const jenkinsShellBlockStart = /\b(?:sh|bat|powershell|pwsh)\s*\(?\s*(?:script\s*:\s*)?"""/;

const commentLine = /^\s*(?:#|\/\/|\*)/;
const maxLineLength = 2_000;

export const ciScriptInjectionRule: Rule = {
  id: "ci-script-injection",
  description: "Flags CI pipelines outside GitHub Actions that paste commit messages, branch names, or titles into shell scripts, in Azure Pipelines, Jenkins, Drone, Woodpecker, and CircleCI.",
  run({ files, config }) {
    if (!config.rules.ciScriptInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const system: System | undefined = jenkinsFile.test(file.path)
        ? "Jenkins"
        : droneFile.test(file.path)
          ? "Drone or Woodpecker"
          : circleFile.test(file.path)
            ? "CircleCI"
            : azureFile.test(file.path)
              ? "Azure Pipelines"
              : undefined;
      if (system === undefined || file.patch === undefined || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: number[] = [];
      if (system === "Jenkins") {
        let inShellBlock = false;
        for (const { line, content, added, startsHunk } of lines) {
          if (startsHunk) {
            inShellBlock = false;
          }
          const opensBlock = !inShellBlock && jenkinsShellBlockStart.test(content) && (content.match(/"""/g) ?? []).length === 1;
          const inShell = inShellBlock || jenkinsShellString.test(content);
          if (inShellBlock && content.includes('"""')) {
            inShellBlock = false;
          } else if (opensBlock) {
            inShellBlock = true;
          }
          if (added && content.length <= maxLineLength && !commentLine.test(content) && inShell && jenkinsVariable.test(content)) {
            found.push(line);
          }
        }
      } else {
        const pattern = system === "Azure Pipelines" ? azureMacro : system === "CircleCI" ? circleParameter : droneVariable;
        // The indentation of the script key whose block the line is in.
        let blockIndent: number | undefined;
        for (const { line, content, added, startsHunk } of lines) {
          if (startsHunk) {
            blockIndent = undefined;
          }
          const indent = /^\s*/.exec(content)?.[0].length ?? 0;
          if (blockIndent !== undefined && content.trim() !== "" && !(indent > blockIndent || (indent === blockIndent && /^\s*-\s/.test(content)))) {
            blockIndent = undefined;
          }
          const key = scriptKey.exec(content);
          const inScript = blockIndent !== undefined || key !== null;
          if (key !== null && /^(?:[|>][+-]?\d*)?\s*(?:#.*)?$/.test(key[2] ?? "")) {
            blockIndent = indent;
          }
          if (added && content.length <= maxLineLength && !commentLine.test(content) && inScript && pattern.test(content)) {
            found.push(line);
          }
        }
      }
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found);
      return [
        {
          ruleId: "ci-script-injection",
          title: "CI script runs text from a pull request",
          severity: "high" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${text} ${plural ? "paste" : "pastes"} the ${system === "Jenkins" ? "pull request's title, branch, or author" : "commit message, branch, or title"} into ${system === "Azure Pipelines" ? "an" : "a"} ${system} script before the shell runs it, so a pull request named \`"; printenv; #\` runs its own commands in the pipeline, with its secrets and its access to deploy.`,
          recommendation:
            "Pass the value to the script through an environment variable and quote it, as in `env: { TITLE: $(Build.SourceVersionMessage) }` with `echo \"$TITLE\"`, or in Jenkins with single-quoted `sh 'echo \"$CHANGE_TITLE\"'`, which the shell reads as data. In Drone and Woodpecker, write `$${DRONE_COMMIT_MESSAGE}` so the shell reads the variable instead of the pipeline pasting it."
        }
      ];
    });
  }
};
