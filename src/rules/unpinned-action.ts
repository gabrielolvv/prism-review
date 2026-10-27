import { addedLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const workflowFile = /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/;
const usesLine = /^\s*(?:-\s*)?uses:\s*["']?([^"'\s#]+)/;
// A full commit SHA cannot be moved to other code; tags and branches can.
const commitSha = /^[0-9a-f]{40}$/i;
const maxListed = 3;

export const unpinnedActionRule: Rule = {
  id: "unpinned-action",
  description: "Flags third-party actions and container images in workflows that are not pinned to a commit SHA or digest.",
  // A path setting must not hide a change to what a workflow runs.
  seesIgnoredFiles: true,
  run({ files, config }) {
    const ruleConfig = config.rules.unpinnedActions;
    if (!ruleConfig.enabled) {
      return [];
    }
    const allowedOwners = new Set(ruleConfig.allowedOwners.map((owner) => owner.toLowerCase()));

    return files.flatMap((file) => {
      if (file.patch === undefined || !workflowFile.test(file.path)) {
        return [];
      }

      const found = addedLines(file.patch).flatMap(({ line, content }) => {
        const target = usesLine.exec(content)?.[1];
        const kind = target === undefined ? undefined : unpinnedKind(target, allowedOwners);
        return kind === undefined || target === undefined ? [] : [{ line, kind, target }];
      });
      if (found.length === 0) {
        return [];
      }

      const actions = unique(found.filter((match) => match.kind === "action").map((match) => match.target));
      const images = unique(found.filter((match) => match.kind === "image").map((match) => match.target));
      const parts = [
        actions.length > 0
          ? `${actions.length > 1 ? "actions" : "an action"} by a tag or branch that can be moved to other code (${list(actions)})`
          : "",
        images.length > 0
          ? `${images.length > 1 ? "container images" : "a container image"} without a digest (${list(images)})`
          : ""
      ].filter(Boolean);
      const { text, plural } = describeLines(found.map((match) => match.line));

      return [
        {
          ruleId: "unpinned-action",
          title: "Action not pinned to a commit",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          message: `${text} ${plural ? "use" : "uses"} ${parts.join(", and ")}.`,
          recommendation:
            "Pin each action to the full commit SHA of a release, with the tag in a comment (uses: owner/action@<sha> # v4.2.0), and each image to a digest. Dependabot and Renovate can keep pinned versions up to date."
        }
      ];
    });
  }
};

function unpinnedKind(target: string, allowedOwners: Set<string>): "action" | "image" | undefined {
  if (target.startsWith("./") || target.includes("${{")) {
    return undefined;
  }
  if (target.startsWith("docker://")) {
    return target.includes("@sha256:") ? undefined : "image";
  }
  const at = target.lastIndexOf("@");
  if (at < 0) {
    return undefined;
  }
  const owner = target.slice(0, target.indexOf("/")).toLowerCase();
  return allowedOwners.has(owner) || commitSha.test(target.slice(at + 1)) ? undefined : "action";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// Action references come from the pull request, so only plain ones are shown.
function list(targets: string[]): string {
  const shown = targets.filter((target) => /^[\w.:/@-]{1,200}$/.test(target)).slice(0, maxListed);
  const more = targets.length - shown.length;
  return [...shown, ...(more > 0 ? [`${more} more`] : [])].join(", ");
}
