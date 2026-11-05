import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// Host paths that let a container read the host's secrets, change its configuration, load kernel
// modules, or start containers of its own. The Docker socket is left to `privileged-container`.
const sensitivePaths = [
  "/",
  "/etc",
  "/root",
  "/home",
  "/proc",
  "/sys",
  "/dev",
  "/boot",
  "/lib/modules",
  "/usr/lib/modules",
  "/var/lib/kubelet",
  "/var/lib/docker",
  "/var/lib/containerd",
  "/var/lib/etcd",
  "/etc/kubernetes",
  "/run/containerd",
  "/var/run/containerd",
  "/run/crio",
  "/var/run/crio",
  "/run/podman",
  "/var/run/podman"
];
// The user's own credential folders, as `~/.ssh` or `$HOME/.aws`.
const credentialFolder = /^(?:~|\$\{?HOME\}?|\/root|\/home\/[^/]+)\/\.(?:ssh|aws|kube|docker|gnupg|config\/gcloud|azure)(?:\/|$)/;

// Kubernetes' `hostPath: { path: ... }` and Terraform's `host_path { path = ... }`.
const hostPathKey = /^\s*-?\s*(?:hostPath|host_path)\s*[:{]/;
const pathValue = /^\s*-?\s*path\s*[:=]\s*["']?([^"'\s#]+)["']?\s*$/;
const inlineHostPath = /\b(?:hostPath|host_path)\s*:?\s*\{\s*path\s*[:=]\s*["']?([^"'\s,}]+)/;
const hostPathWindow = 3;
// Compose's short syntax, `- /etc:/host/etc:ro`, and its long syntax's `source:`.
const composeShort = /^\s*-\s*["']?((?:\/|~\/|\$\{?HOME\}?\/)[^:"'\s]*):([^:"'\s]+)(?::([\w,]+))?["']?\s*(?:#.*)?$/;
const composeSource = /^\s*-?\s*source\s*:\s*["']?((?:\/|~\/|\$\{?HOME\}?\/)[^"'\s#]*)["']?\s*$/;
// `docker run -v /:/host`, `--volume=/etc:/etc`, and `--mount type=bind,source=/,...`.
const dockerVolume = /(?:\s-v|--volume)[=\s]+["']?((?:\/|~\/|\$\{?HOME\}?\/)[^:"'\s]*):([^:"'\s]+)(?::([\w,]+))?/g;
const dockerMount = /--mount[=\s]+["']?[^"'\s]*\b(?:source|src)=((?:\/|~\/|\$\{?HOME\}?\/)[^,"'\s]*)([^"'\s]*)/g;

const yamlFile = /\.(?:ya?ml|tpl|j2)$/i;
const terraformFile = /\.tf$/i;
const commandFile = /\.(?:sh|bash|zsh|ya?ml|mk)$|(?:^|\/)(?:Makefile|Procfile|Jenkinsfile[^/]*)$/i;
// CI service containers and development setups are thrown away after a run.
// Ansible's Molecule scenarios are test setups too.
const ciOrTestSetup = /(?:^|\/)(?:molecule|\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer|azure-pipelines[^/]*|bitbucket-pipelines[^/]*|Jenkinsfile[^/]*)(?:\/|$)|(?:^|\/)(?:(?:docker-)?compose\.override|molecule)\.ya?ml$/i;

const commentLine = /^\s*(?:#|\/\/|\{\{-?\s*\/\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const hostPathMountRule: Rule = {
  id: "host-path-mount",
  description: "Flags containers that mount the host's root, system folders, container runtime state, or credential folders.",
  run({ files, config }) {
    if (!config.rules.hostPathMount.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const yaml = yamlFile.test(file.path);
      const terraform = terraformFile.test(file.path);
      const commands = commandFile.test(file.path);
      if (
        (!yaml && !terraform && !commands) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test setups run on a developer's machine.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; path: string; readOnly: boolean }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const mounts: Array<{ path: string; readOnly: boolean }> = [];
        if (yaml || terraform) {
          const inline = inlineHostPath.exec(content);
          const value = pathValue.exec(content);
          if (inline !== null) {
            mounts.push({ path: inline[1] ?? "", readOnly: mountedReadOnly(lines, volumeName(lines, index)) });
          } else if (value !== null && lines.slice(Math.max(0, index - hostPathWindow), index).some(({ content: before }) => hostPathKey.test(before))) {
            mounts.push({ path: value[1] ?? "", readOnly: mountedReadOnly(lines, volumeName(lines, index)) });
          }
        }
        if (yaml) {
          const short = composeShort.exec(content);
          if (short !== null) {
            mounts.push({ path: short[1] ?? "", readOnly: /\bro\b/.test(short[3] ?? "") });
          }
          const source = composeSource.exec(content);
          if (source !== null && lines.slice(Math.max(0, index - 1), index + 4).some(({ content: other }) => /\btype\s*:\s*["']?bind\b/.test(other))) {
            mounts.push({ path: source[1] ?? "", readOnly: lines.slice(Math.max(0, index - 2), index + 4).some(({ content: other }) => /\bread_only\s*:\s*true\b/.test(other)) });
          }
        }
        if (commands || yaml) {
          for (const match of content.matchAll(dockerVolume)) {
            mounts.push({ path: match[1] ?? "", readOnly: /\bro\b/.test(match[3] ?? "") });
          }
          for (const match of content.matchAll(dockerMount)) {
            mounts.push({ path: match[1] ?? "", readOnly: /\b(?:readonly|ro)\b/.test(match[2] ?? "") });
          }
        }
        const sensitive = mounts.find(({ path }) => isSensitive(path));
        if (sensitive !== undefined) {
          found.push({ line, path: normalize(sensitive.path), readOnly: sensitive.readOnly });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const paths = [...new Set(found.map(({ path }) => `\`${path}\``))];
      return [
        {
          ruleId: "host-path-mount",
          title: "Sensitive host path mounted",
          severity: found.some(({ readOnly }) => !readOnly) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "mount" : "mounts"} ${listOf(paths)} from the host into a container, so anyone who takes over the container can read the host's secrets and, where the mount is writable, change the host or start containers of their own, which gives them the host and every container on it.`,
          recommendation:
            "Mount only the folders the container needs, such as a data folder under `/var/lib/<app>`, read-only where it can be, and use a Kubernetes Secret, a ConfigMap, or a projected service account token instead of the host's files. Agents that need host access, such as node exporters, should mount the narrowest paths read-only and run in their own namespace."
        }
      ];
    });
  }
};

// The name of the Kubernetes volume a hostPath belongs to, from `- name: ...` just above it.
function volumeName(lines: Array<{ content: string }>, index: number): string | undefined {
  for (let before = index; before >= Math.max(0, index - 4); before -= 1) {
    const name = /^\s*-?\s*name\s*:\s*["']?([\w.-]+)["']?\s*$/.exec(lines[before]?.content ?? "")?.[1];
    if (name !== undefined) {
      return name;
    }
  }
  return undefined;
}

// Whether every volumeMount of the named volume in the patch is `readOnly: true`.
function mountedReadOnly(lines: Array<{ content: string }>, name: string | undefined): boolean {
  if (name === undefined) {
    return false;
  }
  const entry = new RegExp(String.raw`^\s*-?\s*name\s*:\s*["']?${name.replace(/[.]/g, "\\.")}["']?\s*$`);
  const mounts = lines
    .map((_, index) => index)
    .filter((index) => entry.test(lines[index]?.content ?? ""))
    .map((index) => lines.slice(Math.max(0, index - 2), index + 4).map(({ content }) => content))
    .filter((block) => block.some((content) => /\bmountPath\s*:/.test(content)));
  return mounts.length > 0 && mounts.every((block) => block.some((content) => /\breadOnly\s*:\s*true\b/.test(content)));
}

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isSensitive(raw: string): boolean {
  const path = normalize(raw);
  if (credentialFolder.test(path)) {
    return true;
  }
  // The container log folder, which log agents read, is left out like /var/log.
  return (
    sensitivePaths.some((sensitive) => (sensitive === "/" ? path === "/" : path === sensitive || path.startsWith(`${sensitive}/`))) &&
    !/\/docker\.sock$/.test(path) &&
    !/^\/var\/lib\/docker\/containers(?:\/|$)/.test(path)
  );
}
