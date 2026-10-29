import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "cluster-admin" | "anonymous" | "wildcard-verbs" | "wildcard-resources" | "escalation";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  "cluster-admin": "binds the cluster-admin role",
  anonymous: "grants a role to every user or to unauthenticated requests",
  "wildcard-verbs": "allows every verb",
  "wildcard-resources": "covers every resource",
  escalation: "allows the escalate, bind, or impersonate verbs, which grant more than the role holds"
};

const yamlFile = /\.ya?ml$/i;
const documentation = /(?:^|\/)docs?\//i;
// Kubernetes RBAC, from a kind in the lines the diff shows or keys only RBAC objects have.
const rbacMarker = /^\s*kind\s*:\s*["']?(?:Cluster)?Role(?:Binding)?["']?\s*$|^\s*(?:roleRef|apiGroups)\s*:/;
const listKey = /^\s*(?:-\s+)?(verbs|resources|apiGroups)\s*:\s*(.*)$/;
const listItem = /^\s*-\s*(.*?)\s*(?:#.*)?$/;
const wildcard = /^["']?\*["']?$/;
const clusterAdmin = /^\s*name\s*:\s*["']?cluster-admin["']?\s*(?:#.*)?$/;
const everyone = /^\s*(?:-\s+)?name\s*:\s*["']?system:(?:anonymous|unauthenticated|authenticated)["']?\s*(?:#.*)?$/;
const escalationVerbs = new Set(["escalate", "bind", "impersonate"]);
const commentLine = /^\s*#/;

export const kubernetesRbacRule: Rule = {
  id: "kubernetes-rbac",
  description: "Flags Kubernetes RBAC that binds cluster-admin, grants roles to everyone, or allows every verb or resource.",
  run({ files, config }) {
    if (!config.rules.kubernetesRbac.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !yamlFile.test(file.path) ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findGrants(file.patch);
      if (found.length === 0) {
        return [];
      }

      const kinds = new Set(found.map((match) => match.kind));
      const listed = (Object.keys(labels) as Kind[]).filter((kind) => kinds.has(kind));
      // Every verb on every resource is the same as cluster-admin.
      const high = kinds.has("cluster-admin") || kinds.has("anonymous") || (kinds.has("wildcard-verbs") && kinds.has("wildcard-resources"));
      const lines = [...new Set(found.map((match) => match.line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lines);

      return [
        {
          ruleId: "kubernetes-rbac",
          title: high ? "Cluster-wide access granted" : "Broad Kubernetes permissions",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "change" : "changes"} Kubernetes RBAC so that it ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "List the verbs, resources, and API groups each role needs, bind service accounts to those roles instead of cluster-admin, and never bind roles to system:anonymous, system:unauthenticated, or system:authenticated."
        }
      ];
    });
  }
};

function findGrants(patch: string): Array<{ line: number; kind: Kind }> {
  const lines = patchLines(patch);
  if (!lines.some((entry) => rbacMarker.test(entry.content) || rbacMarker.test(entry.hunkContext ?? ""))) {
    return [];
  }

  const found: Array<{ line: number; kind: Kind }> = [];
  let key: string | undefined;
  let keyIndent = 0;

  for (const { line, content, added, startsHunk } of lines) {
    if (startsHunk) {
      key = undefined;
    }
    if (commentLine.test(content) || content.trim() === "") {
      continue;
    }

    const indent = content.length - content.trimStart().length;
    const entry = listKey.exec(content);
    let values: string[] = [];
    if (entry !== null) {
      key = entry[1];
      keyIndent = indent;
      values = inlineValues(entry[2] ?? "");
    } else if (key !== undefined && listItem.test(content) && indent >= keyIndent) {
      values = [listItem.exec(content)?.[1] ?? ""];
    } else {
      key = undefined;
    }

    if (!added) {
      continue;
    }
    if (clusterAdmin.test(content)) {
      found.push({ line, kind: "cluster-admin" });
    }
    if (everyone.test(content)) {
      found.push({ line, kind: "anonymous" });
    }
    if (key === "verbs" && values.some((value) => wildcard.test(value))) {
      found.push({ line, kind: "wildcard-verbs" });
    }
    if (key === "resources" && values.some((value) => wildcard.test(value))) {
      found.push({ line, kind: "wildcard-resources" });
    }
    if (key === "verbs" && values.some((value) => escalationVerbs.has(value.replace(/["']/g, "")))) {
      found.push({ line, kind: "escalation" });
    }
  }

  return found;
}

// `["get", "list"]` or `[*]` on the key's own line; a block list starts on the next line.
function inlineValues(value: string): string[] {
  const inline = /^\[([^\]]{0,1000})\]/.exec(value.trim())?.[1];
  return inline === undefined ? [] : inline.split(",").map((item) => item.trim());
}

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
