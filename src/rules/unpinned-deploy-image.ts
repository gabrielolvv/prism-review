import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// The image a deployment runs: Kubernetes and Compose's `image:`, ECS and Cloud Run's JSON `"image":`,
// and Terraform's `image = "..."`.
const imageLine = /(?:^\s*-?\s*|[{,]\s*)["']?image["']?\s*[:=]\s*["']?([^\s"'#,}]+)["']?\s*(?:[,}#]|$)/;

const deployFile = /\.(?:ya?ml|json|tf|hcl)$/i;
// Files that start things on a cluster or a host, rather than tools' own settings.
const deployContent = /^\s*(?:kind\s*:\s*["']?(?:Deployment|StatefulSet|DaemonSet|Job|CronJob|Pod|ReplicaSet|Service|Rollout)\b|services\s*:\s*$|apiVersion\s*:|resource\s+"(?:kubernetes_|docker_container|aws_ecs_task_definition|google_cloud_run)|"containerDefinitions"\s*:|containerDefinitions\s*:|"?containers"?\s*:)/m;
// CI, dev containers, development Compose files, Molecule, benchmarks, and design notes run
// throwaway containers.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e|integ|integration|bench|benchmarks?|benchmarking|profiling|perf|poc|containerlab|playground)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|design|molecule|\.github|\.gitlab|\.circleci|\.buildkite|\.devcontainer|\.tekton)\/|(?:^|\/)\.drone(?:\.ya?ml$|\/)|(?:^|\/)(?:\.gitlab-ci[^/]*|azure-pipelines[^/]*|bitbucket-pipelines[^/]*|(?:docker-)?compose\.override\.ya?ml|devcontainer\.json|skaffold[^/]*|tilt[^/]*|kind[^/]*\.ya?ml|package(?:-lock)?\.json)$/i;
// Kustomize bases and kubebuilder's `config` folders, whose overlays set the image with `images:`.
const kustomizeBase = /(?:^|\/)(?:base|bases)\/|(?:^|\/)config\/(?:manager|default|webhooks?|metrics-server|prometheus|samples|aso|rbac)\//i;
// Compose files are deployments only where their path says so; most set up a developer's machine.
const composeFile = /^\s*services\s*:\s*$/m;
// Kubernetes' top-level keys, such as `apiVersion: apps/v1`, and not a Compose service's own settings.
const kubernetesFile = /^apiVersion\s*:\s*["']?[\w.-]*\/?v\d|^kind\s*:\s*["']?[A-Z]/m;
const productionPath = /(?:^|[\/_.-])(?:prod|production|stack|deploy|deployment|release|live|swarm)(?:[\/_.-]|$)/i;
// An image whose tag, digest, or registry is set by a key next to it, as in Helm values.
const splitImageKey = /^\s*["']?(?:tag|digest|version|registry|repository|imageTag)["']?\s*:/;
const siblingWindow = 3;
// YAML block scalars, such as a check's remediation text or a script.
const blockScalarStart = /:\s*[|>][+-]?\d*\s*$/;
const commentLine = /^\s*(?:#|\/\/|\{\{-?\s*\/\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const unpinnedDeployImageRule: Rule = {
  id: "unpinned-deploy-image",
  description: "Flags deployments that run a container image with no tag or with `latest`, in Kubernetes, Compose, ECS, Cloud Run, and Terraform.",
  run({ files, config }) {
    if (!config.rules.unpinnedDeployImage.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !deployFile.test(file.path) ||
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
      const contents = lines.map(({ content }) => content).join("\n");
      if (
        !deployContent.test(contents) ||
        kustomizeBase.test(file.path) ||
        (composeFile.test(contents) && !kubernetesFile.test(contents) && !productionPath.test(file.path))
      ) {
        return [];
      }
      const found: Array<{ line: number; image: string }> = [];
      let blockIndent: number | undefined;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        const indent = /^\s*/.exec(content)?.[0].length ?? 0;
        if (startsHunk) {
          blockIndent = undefined;
        }
        if (blockIndent !== undefined) {
          if (content.trim() === "" || indent > blockIndent) {
            return;
          }
          blockIndent = undefined;
        }
        if (blockScalarStart.test(content)) {
          blockIndent = indent;
        }
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const image = imageLine.exec(content)?.[1];
        if (
          image !== undefined &&
          unpinned(image) &&
          !lines.slice(Math.max(0, index - siblingWindow), index + siblingWindow + 1).some(({ content: other }) => splitImageKey.test(other))
        ) {
          found.push({ line, image });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const images = [...new Set(found.map(({ image }) => `\`${image}\``))];
      return [
        {
          ruleId: "unpinned-deploy-image",
          title: "Deployment runs an unpinned image",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "run" : "runs"} ${listOf(images)} without a fixed version, so each restart or new node can pull a different image, including one a compromised registry account pushed, and a rollback cannot return to the image that ran before.`,
          recommendation:
            "Pin every image to a version tag, and to its digest where you can, such as `nginx:1.27.2@sha256:...`, and let a tool such as Renovate or Dependabot propose updates in pull requests."
        }
      ];
    });
  }
};

// Whether an image reference has no tag, or the `latest` tag, and no digest. Template and variable
// references are filled in elsewhere.
function unpinned(image: string): boolean {
  if (/[{}$<>%]|^\w+\.\w+$|^ko:\/\//.test(image) || image.includes("@sha256:") || !/^[\w./:-]+$/.test(image)) {
    return false;
  }
  const lastSlash = image.lastIndexOf("/");
  const name = image.slice(lastSlash + 1);
  const colon = name.lastIndexOf(":");
  // A plain word such as `image: true` or `image: none` is not an image.
  if (colon === -1) {
    return lastSlash !== -1 || /^(?:nginx|redis|postgres|mysql|mariadb|mongo|busybox|alpine|ubuntu|debian|centos|node|python|golang|httpd|traefik|haproxy|memcached|rabbitmq|elasticsearch|kibana|grafana|prometheus|consul|vault|etcd|registry|curlimages|bitnami)$/.test(name);
  }
  return name.slice(colon + 1) === "latest";
}
