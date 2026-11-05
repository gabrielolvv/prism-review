import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Sandbox = "seccomp" | "AppArmor" | "SELinux" | "masked /proc paths";

// Docker's and Podman's `--security-opt` values, in the CLI, Compose's `security_opt`, Terraform's
// `security_opts`, and `runArgs`: `seccomp=unconfined`, `apparmor:unconfined`, `label=disable`, and
// `systempaths=unconfined`, which unmasks /proc and /sys.
const securityOpt = /\b(seccomp|apparmor|systempaths)\s*[=:]\s*["']?unconfined\b|\blabel\s*[=:]\s*["']?disable\b/gi;
const securityOptContext = /security[-_]opts?\b/i;
const securityOptWindow = 3;
// Kubernetes' `seccompProfile:` and `appArmorProfile:` with `type: Unconfined`, and the Terraform
// provider's `seccomp_profile { type = "Unconfined" }`.
const profileType = /^\s*-?\s*["']?type["']?\s*[:=]\s*["']?Unconfined\b/;
const profileKey = /\b(seccompProfile|appArmorProfile|seccomp_profile|app_armor_profile)\b/;
const profileWindow = 2;
// The older annotations, such as `container.apparmor.security.beta.kubernetes.io/agent: unconfined`.
const annotation = /\b(?:container\.)?(seccomp|apparmor)\.security\.(?:alpha|beta)\.kubernetes\.io\/[\w.-]+["']?\s*:\s*["']?unconfined\b/i;
// SELinux's `type: spc_t`, which Kubernetes runs as an unconfined super-privileged container.
const selinuxSpc = /^\s*-?\s*["']?type["']?\s*:\s*["']?spc_t\b/;
const selinuxKey = /\bseLinuxOptions\b/;

const sandboxNames: Record<string, Sandbox> = {
  seccomp: "seccomp",
  apparmor: "AppArmor",
  label: "SELinux",
  systempaths: "masked /proc paths",
  seccompprofile: "seccomp",
  seccomp_profile: "seccomp",
  apparmorprofile: "AppArmor",
  app_armor_profile: "AppArmor"
};

// Container and Kubernetes settings, Terraform, and the scripts that start containers.
const settingsFile = /\.(?:ya?ml|tpl|j2|json|tf|hcl|sh|bash|zsh|mk)$|(?:^|\/)(?:Makefile|Jenkinsfile[^/]*|Procfile)$/i;
// CI service containers, dev containers, and debugging setups are thrown away after a run, and
// dev containers turn seccomp off on purpose so debuggers can attach.
const ciOrTestSetup =
  /(?:^|\/)(?:molecule|\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer|azure-pipelines[^/]*|bitbucket-pipelines[^/]*|Jenkinsfile[^/]*)(?:\/|$)|(?:^|\/)(?:(?:docker-)?compose\.override\.ya?ml|devcontainer\.json)$/i;

const commentLine = /^\s*(?:#|\/\/|\{\{-?\s*\/\*)/;
// JSON schemas and CRDs describe the allowed values, such as `"examples": ["seccomp=unconfined"]`.
const describesValues = /["']?(?:examples?|enum|description|default)["']?\s*:/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const unconfinedContainerRule: Rule = {
  id: "unconfined-container",
  description: "Flags containers that run without their seccomp, AppArmor, or SELinux sandbox.",
  run({ files, config }) {
    if (!config.rules.unconfinedContainer.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !settingsFile.test(file.path) ||
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
      const found: Array<{ line: number; sandboxes: Sandbox[] }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        const before = lines.slice(Math.max(0, index - securityOptWindow), index + 1).map(({ content: other }) => other);
        const sandboxes: Sandbox[] = [];
        if (before.some((other) => securityOptContext.test(other))) {
          for (const match of content.matchAll(securityOpt)) {
            sandboxes.push(sandboxNames[(match[1] ?? "label").toLowerCase()] ?? "seccomp");
          }
        }
        if (profileType.test(content)) {
          const key = lines
            .slice(Math.max(0, index - profileWindow), index)
            .map(({ content: other }) => profileKey.exec(other)?.[1])
            .filter((name): name is string => name !== undefined)
            .at(-1);
          if (key !== undefined) {
            sandboxes.push(sandboxNames[key.toLowerCase()] ?? "seccomp");
          }
        }
        const annotated = annotation.exec(content);
        if (annotated !== null) {
          sandboxes.push(sandboxNames[(annotated[1] ?? "").toLowerCase()] ?? "seccomp");
        }
        if (selinuxSpc.test(content) && lines.slice(Math.max(0, index - profileWindow), index).some(({ content: other }) => selinuxKey.test(other))) {
          sandboxes.push("SELinux");
        }
        if (sandboxes.length > 0) {
          found.push({ line, sandboxes });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const sandboxes = [...new Set(found.flatMap(({ sandboxes: names }) => names))];
      return [
        {
          ruleId: "unconfined-container",
          title: "Container sandbox turned off",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "turn" : "turns"} off the container's ${listOf(sandboxes)} sandbox, so a process that takes over the container can reach kernel interfaces the sandbox blocks, which is how most container escapes reach the host.`,
          recommendation:
            "Keep the runtime's default profiles, such as `seccompProfile: { type: RuntimeDefault }` and Docker's default seccomp and AppArmor profiles. When a container needs a blocked call, such as `ptrace` for a profiler, write a custom profile that allows only that call, or add the one capability it needs."
        }
      ];
    });
  }
};
