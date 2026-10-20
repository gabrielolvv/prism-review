import { matchAddedLines, patchLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const workflowFile = /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/;

// Contexts an outside contributor controls, from GitHub Security Lab's list of untrusted input.
// `*` stands for any array index. A path that contains one of these, such as
// `github.event.pull_request` passed to toJSON, is untrusted as well.
const untrustedPaths = [
  "github.head_ref",
  "github.event.issue.title",
  "github.event.issue.body",
  "github.event.pull_request.title",
  "github.event.pull_request.body",
  "github.event.pull_request.head.ref",
  "github.event.pull_request.head.label",
  "github.event.pull_request.head.repo.default_branch",
  "github.event.comment.body",
  "github.event.review.body",
  "github.event.review_comment.body",
  "github.event.discussion.title",
  "github.event.discussion.body",
  "github.event.pages.*.page_name",
  "github.event.commits.*.message",
  "github.event.commits.*.author.email",
  "github.event.commits.*.author.name",
  "github.event.head_commit.message",
  "github.event.head_commit.author.email",
  "github.event.head_commit.author.name",
  "github.event.workflow_run.head_branch",
  "github.event.workflow_run.head_commit.message",
  "github.event.workflow_run.head_commit.author.email",
  "github.event.workflow_run.head_commit.author.name"
].map((path) => path.split("."));

const scriptKeys = new Set(["run", "script"]);
// `key: value` on one line, as in an env, with, or if entry, or a list item that starts one.
const mapping = /^(\s*)(?:-\s+)?([\w.-]+)\s*:(?:\s+(.*))?$/;
const blockScalar = /^[|>][+-]?\d*\s*(?:#.*)?$/;

const warnings: Array<[string, RegExp]> = [
  ["pull_request_target trigger", /^\s*(?:-\s*)?pull_request_target\s*:?\s*(?:#.*)?$|^\s*on\s*:.*\bpull_request_target\b/],
  ["write-all permissions", /^\s*permissions:\s*write-all\b/],
  [
    "checkout of pull request code",
    /^\s*ref:\s*.*(?:\bgithub\.event\.pull_request\.head\.(?:sha|ref)\b|\bgithub\.head_ref\b|refs\/pull\/)/
  ]
];

export const workflowRiskRule: Rule = {
  id: "workflow-risk",
  description: "Flags script injection, risky triggers, and broad permissions added to GitHub Actions workflows.",
  // A path setting must not be able to hide script injection.
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.workflowRisk.enabled) {
      return [];
    }

    return files
      .filter((file) => file.patch !== undefined && workflowFile.test(file.path))
      .flatMap((file) => {
        const injections = findInjections(file.patch ?? "");
        const flagged = matchAddedLines(file.patch ?? "", warnings, /^\s*#/);
        const lines = [...injections.map(({ line }) => line), ...flagged.map(({ line }) => line)];
        if (lines.length === 0) {
          return [];
        }

        const contexts = [...new Set(injections.flatMap(({ contexts }) => contexts))];
        const labels = [
          ...(contexts.length > 0 ? [`untrusted input in a script (${contexts.join(", ")})`] : []),
          ...new Set(flagged.map(({ label }) => label))
        ];
        const { text, plural } = describeLines(lines);

        return [
          {
            ruleId: "workflow-risk",
            title: "Risky workflow change",
            severity: contexts.length > 0 ? ("high" as const) : ("warning" as const),
            file: file.path,
            line: Math.min(...lines),
            message: `${text} ${plural ? "add" : "adds"} risky workflow configuration: ${labels.join(", ")}.`,
            recommendation:
              "Pass untrusted values through env variables instead of ${{ }} in scripts, avoid running pull request code under pull_request_target, and grant only the permissions each job needs."
          }
        ];
      });
  }
};

// Walks the lines the patch shows and decides, for each added line, whether it is executed:
// a `run` or `script` value, or a line inside one of their block scalars. Other mapping values,
// such as env, with, if, name, and run-name, are data. A line whose block began before the hunk
// is treated as a script unless it is itself a mapping, the same as a line with no context.
function findInjections(patch: string): Array<{ line: number; contexts: string[] }> {
  const found: Array<{ line: number; contexts: string[] }> = [];
  let block: { indent: number; script: boolean } | undefined;

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      block = undefined;
    }

    const indent = content.length - content.trimStart().length;
    if (block && content.trim() !== "" && indent <= block.indent) {
      block = undefined;
    }

    let executed: boolean;
    if (block) {
      executed = block.script;
    } else {
      const entry = mapping.exec(content);
      const key = entry?.[2];
      const value = entry?.[3] ?? "";
      executed = key === undefined || scriptKeys.has(key);
      if (entry && key && blockScalar.test(value)) {
        block = { indent: (entry[1] ?? "").length + (/^\s*-\s+/.test(content) ? content.trimStart().indexOf(key) : 0), script: scriptKeys.has(key) };
      }
    }

    if (!added || /^\s*#/.test(content)) {
      continue;
    }

    const contexts = executed ? untrustedContexts(content) : [];
    if (contexts.length > 0) {
      found.push({ line, contexts });
    }
  }

  return found;
}

function untrustedContexts(text: string): string[] {
  const contexts: string[] = [];

  for (const [, expression = ""] of text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
    // `github.event['issue']["title"]` and `commits[0]` read the same values as the dot forms.
    const normalized = expression
      .replace(/\[\s*['"]([\w-]+)['"]\s*\]/g, ".$1")
      .replace(/\[\s*\d+\s*\]/g, ".*");

    for (const [path] of normalized.matchAll(/\bgithub(?:\.[\w*-]+)*/g)) {
      if (isUntrusted(path.split("."))) {
        contexts.push(path);
      }
    }
  }

  return contexts;
}

// A path is untrusted when it names an untrusted value or an object that contains one.
function isUntrusted(path: string[]): boolean {
  return untrustedPaths.some(
    (untrusted) =>
      path.length <= untrusted.length &&
      path.every((segment, index) => untrusted[index] === "*" || untrusted[index] === segment)
  );
}
