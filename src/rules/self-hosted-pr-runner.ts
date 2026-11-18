import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";

type Job = { name: string; lines: PatchLine[] };
type Found = { line: number; job: string };

const workflowFile = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const exampleWorkflow = /(?:^|[\/_.-])(?:examples?|samples?|demos?|templates?|fixtures?|testdata)(?:[\/_.-]|$)/i;

// `on: pull_request`, `on: [push, pull_request]`, `- pull_request`, and `pull_request:` under `on:`.
// `pull_request_target` runs the base branch's code and is read by `workflow-risk`.
const pullRequestTrigger = /^\s*on\s*:.*\bpull_request\b(?!_)|^\s*-\s*pull_request\s*(?:#.*)?$|^\s+pull_request\s*:\s*(?:#.*)?$|^\s+pull_request\s*$/m;
const jobsKey = /^jobs\s*:\s*(?:#.*)?$/;
const jobKey = /^ {2}(["']?[\w-]+["']?)\s*:\s*(?:#.*)?$/;
const runsOn = /^(\s*)runs-on\s*:\s*(.*)$/;
const selfHosted = /\bself-hosted\b/;
const matrixReference = /\$\{\{\s*matrix\.([\w-]+)\s*\}\}/;
// Conditions that keep fork pull requests off the job: checks of the pull request's head repository,
// jobs kept to a named repository, such as a private enterprise copy, directly or through an earlier
// job's output, jobs for other events, and jobs that wait for a maintainer's label or association.
const forkGuard =
  /head\.repo\.(?:full_name|fork|owner)|\bgithub\.repository\b|github\.repository_owner|github\.event_name\s*(?:!=|==)|author_association|pull_request\.labels|github\.event\.label\.name|github\.actor\s*==|needs\.[\w-]+\.outputs\.[\w-]*(?:repo|repository|enterprise|private|fork)[\w-]*/i;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

function jobsIn(lines: PatchLine[]): Job[] {
  const start = lines.findIndex(({ content }) => jobsKey.test(content));
  if (start < 0) {
    return [];
  }
  const jobs: Job[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line.content) && line.content.trim() !== "" && !/^\s*#/.test(line.content)) {
      break;
    }
    const key = jobKey.exec(line.content);
    if (key !== null) {
      jobs.push({ name: (key[1] ?? "").replace(/["']/g, ""), lines: [line] });
      continue;
    }
    jobs.at(-1)?.lines.push(line);
  }
  return jobs;
}

// The `runs-on` lines of a job that pick a self-hosted runner, directly or through its matrix.
function selfHostedRunsOn(job: Job): PatchLine[] {
  const found: PatchLine[] = [];
  job.lines.forEach((line, index) => {
    const match = runsOn.exec(line.content);
    if (match === null || /^\s*#/.test(line.content)) {
      return;
    }
    const indent = (match[1] ?? "").length;
    const value = (match[2] ?? "").replace(/\s+#.*$/, "");
    // A list on the lines below, such as `- self-hosted`.
    const below = job.lines.slice(index + 1).filter((_, position, rest) => rest.slice(0, position + 1).every(({ content }) => content.trim() === "" || indentOf(content) > indent));
    const listed = value.trim() === "" && below.some(({ content }) => /^\s*-\s*["']?self-hosted["']?\s*$/.test(content));
    if (value.includes("${{")) {
      // Expressions that pick a runner by repository keep self-hosted runners to that repository.
      if (/github\.repository/.test(value)) {
        return;
      }
      const reference = matrixReference.exec(value);
      const matrix = reference === null ? [] : job.lines.filter(({ content }) => new RegExp(`^\\s*-?\\s*["']?${reference[1]}["']?\\s*:`).test(content));
      if (matrix.some(({ content }) => selfHosted.test(content)) || selfHosted.test(value)) {
        found.push(line);
      }
      return;
    }
    if (selfHosted.test(value) || listed) {
      found.push(line);
    }
  });
  return found;
}

// The job's own `if:`, including a block scalar on the lines below it.
function jobCondition(job: Job): string {
  const index = job.lines.findIndex(({ content }) => /^ {4}if\s*:/.test(content));
  if (index < 0) {
    return "";
  }
  const parts = [job.lines[index]?.content ?? ""];
  for (const line of job.lines.slice(index + 1)) {
    if (line.content.trim() !== "" && indentOf(line.content) <= 4) {
      break;
    }
    parts.push(line.content);
  }
  return parts.join(" ");
}

export const selfHostedPrRunnerRule: Rule = {
  id: "self-hosted-pr-runner",
  description:
    "Warns about GitHub Actions workflows that run `pull_request` jobs on self-hosted runners, where code from forks runs on the organization's machines, unless the job keeps fork pull requests out.",
  run({ files, config }) {
    if (!config.rules.selfHostedPrRunner.enabled) {
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
      if (!pullRequestTrigger.test(text)) {
        return [];
      }
      const triggerAdded = lines.some(({ content, added }) => added && pullRequestTrigger.test(content));

      const found: Found[] = jobsIn(lines).flatMap((job) => {
        if (forkGuard.test(jobCondition(job))) {
          return [];
        }
        return selfHostedRunsOn(job)
          .filter((line) => line.added || triggerAdded || job.lines.some(({ added, content }) => added && selfHosted.test(content)))
          .map((line) => ({ line: line.line, job: job.name }));
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text: where, plural } = describeLines(lineNumbers);
      const jobs = [...new Set(found.map(({ job }) => `\`${job}\``))];
      return [
        {
          ruleId: "self-hosted-pr-runner",
          title: "Pull request jobs on a self-hosted runner",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "run" : "runs"} ${listOf(jobs)} on a self-hosted runner for pull requests, including those from forks, whose code then runs on your machine. By default, GitHub asks a maintainer to approve the run only for first-time contributors, and code that runs there can stay on the machine, read the secrets and caches of later jobs, and reach the network the runner is in, as in the 2024 attacks on PyTorch's runners.`,
          recommendation:
            "Run pull request jobs on GitHub-hosted runners, or keep self-hosted jobs to branches of this repository with `if: github.event.pull_request.head.repo.full_name == github.repository`. If fork pull requests must run there, use ephemeral runners that are rebuilt after every job and kept away from internal networks and other jobs' secrets, and require approval for all outside contributors."
        }
      ];
    });
  }
};
