import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { runsWorkspaceCode } from "./workflow-artifact-poisoning.js";

type Found = { line: number; runsCode: boolean };

const workflowFile = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const exampleWorkflow = /(?:^|[\/_.-])(?:examples?|samples?|demos?|templates?|fixtures?|testdata)(?:[\/_.-]|$)/i;

// Triggers that run with the base repository's secrets and a write token, whatever the pull request
// holds.
const privilegedTrigger =
  /^\s*(?:pull_request_target|issue_comment|workflow_run)\s*:|^\s*on\s*:.*\b(?:pull_request_target|issue_comment|workflow_run)\b|^\s*-\s*(?:pull_request_target|issue_comment|workflow_run)\s*$/m;
// Commands that bring a pull request's code into the workspace. `workflow-risk` reads
// `actions/checkout` with a pull request `ref`.
const fetchesPullRequest =
  /\b(?:gh|hub)\s+pr\s+checkout\b|\bgit\s+fetch\b[^\n#]*\bpull\/(?:\$\{\{[^}]*\}\}|[^\s/]+)\/(?:head|merge)\b|\bgit\s+(?:checkout|switch|reset\s+--hard|merge|pull)\b[^\n#]*(?:\bpull_request\.head\.(?:sha|ref)\b|\bgithub\.head_ref\b|\bhead_sha\b|\bpull\/(?:\$\{\{[^}]*\}\}|[^\s/]+)\/head\b)|\bgit\s+clone\b[^\n#]*\bhead\.repo\.(?:clone_url|full_name|ssh_url)\b/;
// Checks that only maintainers can start the job: their association or team, a permission lookup, an
// approval label, or a pull request from this repository's own branches.
const maintainerGuard =
  /author_association|isTeamMember|teams?-membership|getCollaboratorPermissionLevel|collaborators\/[^\s/]+\/permission|\bpermission\s*(?:==|!=|in\b)|has-permissions?|github\.event\.label\.name|pull_request\.labels|head\.repo\.full_name\s*==|head\.repo\.fork\s*==\s*false|!\s*github\.event\.pull_request\.head\.repo\.fork/;
const commentLine = /^\s*#/;

export const privilegedPrCheckoutRule: Rule = {
  id: "privileged-pr-checkout",
  description:
    "Flags `pull_request_target`, `issue_comment`, and `workflow_run` workflows that fetch a pull request's code with `gh pr checkout` or git commands, where it runs with the repository's secrets, unless only maintainers can start the job.",
  run({ files, config }) {
    if (!config.rules.privilegedPrCheckout.enabled) {
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
      if (!privilegedTrigger.test(text) || maintainerGuard.test(text)) {
        return [];
      }
      const triggerAdded = lines.some(({ content, added }) => added && privilegedTrigger.test(content));

      const found: Found[] = [];
      lines.forEach(({ line, content, added }, index) => {
        if (commentLine.test(content) || !fetchesPullRequest.test(content) || (!added && !triggerAdded)) {
          return;
        }
        const runsCode = lines.slice(index + 1).some(({ content: later }) => !commentLine.test(later) && runsWorkspaceCode.test(later));
        found.push({ line, runsCode });
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const runsCode = found.some((entry) => entry.runsCode);
      return [
        {
          ruleId: "privileged-pr-checkout",
          title: "Pull request code fetched in a privileged workflow",
          severity: runsCode ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "fetch" : "fetches"} a pull request's code in a workflow that runs with the repository's secrets and a write token, and that anyone can start from a fork or a comment${runsCode ? ". Later steps run code from the workspace, so the pull request's own scripts and build files run with that access" : ". Tools that read the workspace, such as linters and scanners, can be led by the pull request's own settings"}.`,
          recommendation:
            "Run pull request code in a `pull_request` workflow, which has no secrets for forks, and pass results to a privileged workflow as data. If a comment or label must start it, check first that a maintainer asked, with `github.event.comment.author_association` or a permission lookup, and pin the commit that was reviewed instead of the branch's latest."
        }
      ];
    });
  }
};
