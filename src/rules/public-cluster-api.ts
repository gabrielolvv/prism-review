import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Platform = "EKS" | "GKE" | "AKS";

// The lists of addresses allowed to reach the cluster's API, in Terraform, CloudFormation, eksctl,
// ARM templates, and the terraform-aws-modules EKS module.
const allowlistKey =
  /\b(?:public_access_cidrs|cluster_endpoint_public_access_cidrs|endpoint_public_access_cidrs|PublicAccessCidrs|publicAccessCIDRs|authorized_ip_ranges|api_server_authorized_ip_ranges|authorizedIPRanges|master_authorized_networks(?:_config)?|masterAuthorizedNetworksConfig)\b/;
const allowlistPlatform: Array<[RegExp, Platform]> = [
  [/public_access_cidrs|PublicAccessCidrs|publicAccessCIDRs/i, "EKS"],
  [/master_authorized_networks|masterAuthorizedNetworks/i, "GKE"],
  [/authorized_ip_ranges|authorizedIPRanges/i, "AKS"]
];
const worldCidr = /(?:^|[^\d.])0\.0\.0\.0\/0\b|(?:^|[^:\w])::\/0\b/;
const allowlistWindow = 4;

// A public endpoint turned on, for the check that the same new cluster has no allowlist.
const eksPublic = /^\s*["']?(?:endpoint_public_access|cluster_endpoint_public_access|EndpointPublicAccess)["']?\s*[:=]\s*["']?true\b/;
const eksctlPublic = /^\s*publicAccess\s*:\s*true\b/;
// New clusters, whose whole definition is in the change.
const clusterHeader: Array<[RegExp, Platform]> = [
  [/^\s*resource\s+"aws_eks_cluster"|^\s*Type\s*:\s*["']?AWS::EKS::Cluster\b|^\s*"Type"\s*:\s*"AWS::EKS::Cluster"|^\s*kind\s*:\s*ClusterConfig\b|^\s*source\s*=\s*"[^"]*terraform-aws-modules\/eks\/aws/, "EKS"],
  [/^\s*resource\s+"google_container_cluster"/, "GKE"],
  [/^\s*resource\s+"azurerm_kubernetes_cluster"\s/, "AKS"]
];
// A cluster whose API has no public endpoint at all.
const privateOnly = /\benable_private_endpoint\s*=\s*true\b|\bprivate_cluster_enabled\s*=\s*true\b|\benablePrivateCluster["']?\s*:\s*true\b/;

const settingsFile = /\.(?:tf|tf\.json|hcl|ya?ml|json|template)$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
// Variable and output descriptions, and schemas, name the settings without setting them.
const describesValues = /\b(?:description|default_description|help)\s*[:=]/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const publicClusterApiRule: Rule = {
  id: "public-cluster-api",
  description: "Flags managed Kubernetes clusters, on EKS, GKE, and AKS, whose API is open to the whole internet.",
  run({ files, config }) {
    if (!config.rules.publicClusterApi.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !settingsFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test clusters are torn down after use.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const hasAllowlist = allowlistKey.test(text);
      const found: Array<{ line: number; platform: Platform }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        // The whole internet in the allowlist itself, on the key's line or the list's next lines.
        // A module's input default, which callers override, mirrors the provider's own default.
        if (worldCidr.test(content) && /^\s*default\s*=/.test(content) && lines.slice(Math.max(0, index - allowlistWindow), index).some(({ content: other }) => /^\s*variable\s+"/.test(other))) {
          return;
        }
        if (worldCidr.test(content)) {
          const key = lines
            .slice(Math.max(0, index - allowlistWindow), index + 1)
            .map(({ content: other }) => allowlistKey.exec(other)?.[0])
            .filter((name): name is string => name !== undefined)
            .at(-1);
          const platform = key === undefined ? undefined : allowlistPlatform.find(([pattern]) => pattern.test(key))?.[1];
          if (platform !== undefined) {
            found.push({ line, platform });
          }
          return;
        }
        // A new cluster with a public endpoint and no allowlist, which AWS, Google, and Azure open
        // to every address.
        if (hasAllowlist || privateOnly.test(text)) {
          return;
        }
        const header = clusterHeader.find(([pattern]) => pattern.test(content));
        if (header !== undefined && header[1] !== "EKS") {
          found.push({ line, platform: header[1] });
          return;
        }
        if (
          (eksPublic.test(content) || (eksctlPublic.test(content) && /^\s*kind\s*:\s*ClusterConfig\b/m.test(text))) &&
          lines.some(({ content: other, added: isAdded }) => isAdded && (clusterHeader[0]?.[0].test(other) ?? false))
        ) {
          found.push({ line, platform: "EKS" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const platforms = [...new Set(found.map(({ platform }) => platform))];
      return [
        {
          ruleId: "public-cluster-api",
          title: "Kubernetes API open to the internet",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "leave" : "leaves"} the Kubernetes API of ${listOf(platforms.map((platform) => `an ${platform} cluster`))} open to every address on the internet, so anyone can reach the control plane, try leaked credentials and tokens against it, and use API server flaws before the cluster is patched.`,
          recommendation:
            "Allow only the addresses that manage the cluster, such as a VPN's or CI runners' ranges, in `public_access_cidrs`, `master_authorized_networks_config`, or `authorized_ip_ranges`, or turn the public endpoint off and reach the API through a private endpoint, a bastion, or a VPN."
        }
      ];
    });
  }
};
