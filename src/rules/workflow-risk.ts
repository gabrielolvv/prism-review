import { addedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const workflowFile = /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/;

// Contexts an outside contributor controls, from GitHub Security Lab's list of untrusted input.
const untrustedContext =
  /\bgithub\.(?:head_ref|event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.(?:ref|label|repo\.default_branch))|comment\.body|review\.body|review_comment\.body|discussion\.(?:title|body)|pages(?:\.\*|\[\d+\])\.page_name|(?:commits(?:\.\*|\[\d+\])|head_commit)\.(?:message|author\.(?:email|name))|workflow_run\.(?:head_branch|head_commit\.(?:message|author\.(?:email|name)))))\b/g;

// `KEY: ${{ ... }}` passes the value as data, which is the safe pattern for env, with, and if.
// Only run and script values, and the lines of a multi-line script, are executed.
const dataMapping = /^\s*(?:-\s+)?(?!run\b|script\b)[\w-]+:\s*\$\{\{/;

const warnings: Array<[string, RegExp]> = [
  ["pull_request_target trigger", /\bpull_request_target\b/],
  ["write-all permissions", /^\s*permissions:\s*write-all\b/],
  [
    "checkout of pull request code",
    /^\s*ref:\s*.*(?:\bgithub\.event\.pull_request\.head\.(?:sha|ref)\b|\bgithub\.head_ref\b|refs\/pull\/)/
  ]
];

export const workflowRiskRule: Rule = {
  id: "workflow-risk",
  description: "Flags script injection, risky triggers, and broad permissions added to GitHub Actions workflows.",
  run({ files, config }) {
    if (!config.rules.workflowRisk.enabled) {
      return [];
    }

    return files
      .filter((file) => file.patch !== undefined && workflowFile.test(file.path))
      .flatMap((file) => {
        const injected: string[] = [];
        const kinds: string[] = [];
        const lines: number[] = [];

        for (const { line, content } of addedLines(file.patch ?? "")) {
          if (/^\s*#/.test(content)) {
            continue;
          }

          const found = dataMapping.test(content)
            ? []
            : [...content.matchAll(/\$\{\{([^}]*)\}\}/g)].flatMap(([, expression]) =>
                [...(expression ?? "").matchAll(untrustedContext)].map(([context]) => context)
              );
          const lineKinds = warnings.filter(([, pattern]) => pattern.test(content)).map(([kind]) => kind);

          if (found.length > 0 || lineKinds.length > 0) {
            lines.push(line);
            injected.push(...found);
            kinds.push(...lineKinds);
          }
        }

        if (lines.length === 0) {
          return [];
        }

        const labels = [
          ...(injected.length > 0 ? [`untrusted input in a script (${[...new Set(injected)].join(", ")})`] : []),
          ...new Set(kinds)
        ];
        const { text, plural } = describeLines(lines);

        return [
          {
            ruleId: "workflow-risk",
            title: "Risky workflow change",
            severity: injected.length > 0 ? ("high" as const) : ("warning" as const),
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
