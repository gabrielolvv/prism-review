import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = { label: string; high: boolean; pattern: RegExp };

// Assembled so this file does not match its own pattern.
const privilegedFlag = ["--", "privileged"].join("");

// In the order the message lists them. The high ones give the container root on its host.
const kinds: Kind[] = [
  {
    label: "runs a privileged container",
    high: true,
    pattern: new RegExp(String.raw`\bprivileged["']?\s*:\s*["']?true\b|${privilegedFlag}\b(?!=false)`, "i")
  },
  {
    label: "adds the SYS_ADMIN or ALL capability",
    high: true,
    pattern: /--cap-add[=\s]+["']?(?:CAP_)?(?:ALL|SYS_ADMIN)\b|\b(?:cap_add|add)\s*:\s*\[[^\]]*\b(?:CAP_)?(?:ALL|SYS_ADMIN)\b/
  },
  {
    // A mount of the socket, not a client setting such as DOCKER_HOST=unix:///var/run/docker.sock.
    label: "mounts the Docker socket",
    high: true,
    pattern: /(?:^\s*-\s*["']?|(?:-v|--volume)[=\s]+["']?|\b(?:source|src)=|\bpath:\s*["']?)\/(?:var\/)?run\/docker\.sock\b/
  },
  {
    label: "shares the host's network, process, or IPC namespace",
    high: false,
    pattern: /\bhost(?:Network|PID|IPC)\s*:\s*true\b|^\s*(?:network_mode|pid|ipc)\s*:\s*["']?host\b|--(?:net|network|pid|ipc|uts)[=\s]+host\b/
  },
  { label: "allows privilege escalation", high: false, pattern: /\ballowPrivilegeEscalation\s*:\s*true\b/ },
  { label: "runs as root", high: false, pattern: /\brunAsUser\s*:\s*0\b|\brunAsNonRoot\s*:\s*false\b/ }
];

const capabilityKind = kinds[1] as Kind;
// A YAML list item such as `- SYS_ADMIN`, which only adds a capability under `add:` or `cap_add:`.
const capabilityItem = /^\s*-\s*["']?(?:CAP_)?(?:ALL|SYS_ADMIN)["']?\s*(?:#.*)?$/;
const mappingKey = /^\s*([\w-]+)\s*:\s*(?:#.*)?$/;
const commentLine = /^\s*#/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const privilegedContainerRule: Rule = {
  id: "privileged-container",
  description: "Flags containers that run privileged, mount the Docker socket, or share the host's namespaces.",
  run({ files, config }) {
    if (!config.rules.privilegedContainers.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findSettings(file.patch);
      if (found.length === 0) {
        return [];
      }

      const listed = kinds.filter((kind) => found.some((match) => match.kind === kind));
      const high = listed.some((kind) => kind.high);
      const { text, plural } = describeLines(found.map((match) => match.line));
      const labels = listed.map((kind) => kind.label);

      return [
        {
          ruleId: "privileged-container",
          title: high ? "Privileged container added" : "Container isolation weakened",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "weaken" : "weakens"} a container's isolation from its host: ${joinLabels(labels)}.`,
          recommendation:
            "Anything that breaks out of a privileged container, or reaches the Docker socket, controls the host. Grant only the capabilities the workload needs, run as a non-root user, and keep host namespaces and the Docker socket out unless the workload is trusted."
        }
      ];
    });
  }
};

function findSettings(patch: string): Array<{ line: number; kind: Kind }> {
  const found: Array<{ line: number; kind: Kind }> = [];
  let listKey = "";

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      listKey = "";
    }
    if (commentLine.test(content)) {
      continue;
    }
    const key = mappingKey.exec(content)?.[1];
    if (key !== undefined) {
      listKey = key;
    }
    if (!added) {
      continue;
    }

    for (const kind of kinds) {
      if (kind.pattern.test(content)) {
        found.push({ line, kind });
      }
    }
    if (capabilityItem.test(content) && (listKey === "add" || listKey === "cap_add")) {
      found.push({ line, kind: capabilityKind });
    }
  }

  return found;
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}
