import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { publicClusterApiRule } from "../../src/rules/public-cluster-api.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return publicClusterApiRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPublicClusterApiReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/eks.tf", [
      "resource \"aws_eks_cluster\" \"main\" {",
      "  name     = \"main\"",
      "  vpc_config {",
      "    endpoint_public_access = true",
      "    public_access_cidrs    = [\"0.0.0.0/0\"]",
      "  }",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Kubernetes API open to the internet");
  assert.deepEqual(finding?.lines, [5]);
  assert.equal(
    finding?.message,
    "Line 5 leaves the Kubernetes API of an EKS cluster open to every address on the internet, so anyone can reach the control plane, try leaked credentials and tokens against it, and use API server flaws before the cluster is patched."
  );
}

export function testPublicClusterApiReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    // A public endpoint with no allowlist, which every provider opens to all addresses.
    ["infra/eks.tf", ["resource \"aws_eks_cluster\" \"main\" {", "  vpc_config {", "    endpoint_public_access  = true", "    endpoint_private_access = false", "  }", "}"]],
    ["infra/eks.tf", ["module \"eks\" {", "  source  = \"terraform-aws-modules/eks/aws\"", "  cluster_endpoint_public_access = true", "}"]],
    ["infra/eks.yaml", ["Resources:", "  Cluster:", "    Type: AWS::EKS::Cluster", "    Properties:", "      ResourcesVpcConfig:", "        EndpointPublicAccess: true"]],
    ["clusters/prod.yaml", ["apiVersion: eksctl.io/v1alpha5", "kind: ClusterConfig", "vpc:", "  clusterEndpoints:", "    publicAccess: true", "    privateAccess: true"]],
    ["clusters/prod.yaml", ["kind: ClusterConfig", "vpc:", "  publicAccessCIDRs:", "    - 0.0.0.0/0"]],
    ["infra/gke.tf", ["resource \"google_container_cluster\" \"main\" {", "  name     = \"main\"", "  location = \"us-central1\"", "}"]],
    ["infra/gke.tf", ["  master_authorized_networks_config {", "    cidr_blocks {", "      cidr_block   = \"0.0.0.0/0\"", "      display_name = \"all\"", "    }", "  }"]],
    ["infra/aks.tf", ["resource \"azurerm_kubernetes_cluster\" \"main\" {", "  name     = \"main\"", "  dns_prefix = \"main\"", "}"]],
    ["infra/aks.tf", ["  api_server_access_profile {", "    authorized_ip_ranges = [\"0.0.0.0/0\"]", "  }"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicClusterApiSkipsLimitedApis(): void {
  const cases: Array<[string, string[]]> = [
    // Allowlists of the addresses that manage the cluster, or variables.
    ["infra/eks.tf", ["resource \"aws_eks_cluster\" \"main\" {", "  vpc_config {", "    endpoint_public_access = true", "    public_access_cidrs    = [\"203.0.113.0/24\"]", "  }", "}"]],
    ["infra/eks.tf", ["resource \"aws_eks_cluster\" \"main\" {", "  vpc_config {", "    endpoint_public_access = var.public_access", "  }", "}"]],
    ["infra/eks.tf", ["module \"eks\" {", "  source = \"terraform-aws-modules/eks/aws\"", "  cluster_endpoint_public_access       = true", "  cluster_endpoint_public_access_cidrs = var.admin_cidrs", "}"]],
    ["infra/gke.tf", ["resource \"google_container_cluster\" \"main\" {", "  master_authorized_networks_config {", "    cidr_blocks {", "      cidr_block = \"10.0.0.0/8\"", "    }", "  }", "}"]],
    // Private clusters, and edits to an existing cluster.
    ["infra/gke.tf", ["resource \"google_container_cluster\" \"main\" {", "  private_cluster_config {", "    enable_private_endpoint = true", "  }", "}"]],
    ["infra/aks.tf", ["resource \"azurerm_kubernetes_cluster\" \"main\" {", "  private_cluster_enabled = true", "}"]],
    ["infra/eks.tf", ["    endpoint_public_access = true"]],
    // The world in other lists, such as a security group's.
    ["infra/sg.tf", ["  ingress {", "    from_port   = 443", "    cidr_blocks = [\"0.0.0.0/0\"]", "  }"]],
    // A module's input default, which callers override.
    ["modules/eks/variables.tf", ["variable \"public_access_cidrs\" {", "  type    = list(string)", "  default = [\"0.0.0.0/0\"]", "}"]],
    // Descriptions, development clusters, and documentation.
    ["infra/variables.tf", ["variable \"public_access_cidrs\" {", "  description = \"Defaults to 0.0.0.0/0, which is open to everyone\"", "}"]],
    ["infra/dev/eks.tf", ["    public_access_cidrs = [\"0.0.0.0/0\"]"]],
    ["examples/complete/main.tf", ["resource \"google_container_cluster\" \"main\" {", "}"]],
    ["docs/eks.md", ["    public_access_cidrs = [\"0.0.0.0/0\"]"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicClusterApiSkipsTestsAndCanBeDisabled(): void {
  const lines = ["    public_access_cidrs = [\"0.0.0.0/0\"]"];
  assert.deepEqual(findings([added("test/fixtures/eks.tf", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { publicClusterApi: { enabled: false } } });
  assert.deepEqual(findings([added("infra/eks.tf", lines)], config), []);
}
