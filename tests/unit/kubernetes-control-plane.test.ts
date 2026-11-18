import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { kubernetesControlPlaneRule } from "../../src/rules/kubernetes-control-plane.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return kubernetesControlPlaneRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const staticPod = (component: string, ...flags: string[]) => [
  "apiVersion: v1",
  "kind: Pod",
  "metadata:",
  `  name: ${component}`,
  "spec:",
  "  containers:",
  `    - name: ${component}`,
  "      command:",
  `        - ${component}`,
  ...flags.map((flag) => `        - ${flag}`)
];

export function testKubernetesControlPlaneReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("manifests/etcd.yaml", staticPod("etcd", "--listen-client-urls=http://0.0.0.0:2379", "--client-cert-auth=false", "--data-dir=/var/lib/etcd"))
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Kubernetes control plane left open");
  assert.deepEqual(finding?.lines, [10, 11]);
  assert.equal(
    finding?.message,
    "In lines 10, 11, the cluster serves etcd over plain HTTP beyond localhost and lets etcd accept clients or peers without a certificate. Whoever reaches these ports can read the cluster's Secrets and pod specs, or change workloads, without credentials."
  );
}

export function testKubernetesControlPlaneReadsEachSetting(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    // The API server.
    ["manifests/kube-apiserver.yaml", staticPod("kube-apiserver", "--insecure-port=8080", "--insecure-bind-address=0.0.0.0"), "high"],
    ["manifests/kube-apiserver.yaml", staticPod("kube-apiserver", "--token-auth-file=/etc/kubernetes/tokens.csv"), "warning"],
    ["manifests/kube-apiserver.yaml", staticPod("kube-apiserver", "--enable-admission-plugins=NodeRestriction,AlwaysAdmit"), "warning"],
    // kubeadm and kops settings.
    ["cluster/kubeadm.yaml", ["kind: ClusterConfiguration", "apiServer:", "  extraArgs:", "    token-auth-file: /etc/kubernetes/known_tokens.csv"], "warning"],
    ["clusters/prod.yaml", ["spec:", "  kubeAPIServer:", "    insecurePort: 8080", "  kubelet:", "    anonymousAuth: true"], "high"],
    // etcd, by flag, settings file, and environment.
    ["etcd/etcd.conf.yml", ["name: etcd-0", "client-transport-security:", "  client-cert-auth: false", "  auto-tls: true"], "high"],
    ["etcd/etcd.env", ["ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379"], "high"],
    ["systemd/etcd.service", ["ExecStart=/usr/bin/etcd \\", "  -listen-client-urls http://0.0.0.0:2379 \\", "  -data-dir /var/lib/etcd"], "high"],
    // The kubelet, by flag and configuration file.
    ["bootstrap/node.sh", ["/usr/bin/kubelet --config=/etc/kubernetes/kubelet.yaml --read-only-port=10255"], "warning"],
    ["kubelet/config.yaml", ["kind: KubeletConfiguration", "readOnlyPort: 10255", "authentication:", "  anonymous:", "    enabled: true", "authorization:", "  mode: AlwaysAllow"], "high"],
    ["kubelet/config.json", ["{", "  \"kind\": \"KubeletConfiguration\",", "  \"authentication\": { \"anonymous\": { \"enabled\": true } }", "}"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testKubernetesControlPlaneSkipsSafeSettingsAndChecks(): void {
  const cases: Array<[string, string[]]> = [
    // Safe values and localhost.
    ["manifests/kube-apiserver.yaml", staticPod("kube-apiserver", "--insecure-port=0", "--anonymous-auth=false", "--enable-admission-plugins=NodeRestriction")],
    ["manifests/etcd.yaml", staticPod("etcd", "--listen-client-urls=https://10.0.0.5:2379,http://127.0.0.1:2379", "--client-cert-auth=true")],
    ["kubelet/config.yaml", ["kind: KubeletConfiguration", "readOnlyPort: 0", "authentication:", "  anonymous:", "    enabled: false", "  webhook:", "    enabled: true", "authorization:", "  mode: Webhook"]],
    // Schemas and templated values.
    ["k8s/crds/clusters.yaml", ["kubeAPIServer:", "  properties:", "    tokenAuthFile:", "      type: string", "    insecurePort:", "      type: integer"]],
    ["charts/apiserver/values.yaml", ["kubeAPIServer:", "  insecurePort: {{ .Values.insecurePort }}"]],
    // Benchmark checks that look for these flags.
    [
      "cfg/cis-1.9/master.yaml",
      [
        "  - id: 1.2.2",
        "    text: \"Ensure that the --token-auth-file parameter is not set (Automated)\"",
        "    audit: \"/bin/ps -ef | grep kube-apiserver | grep -v grep\"",
        "    tests:",
        "      test_items:",
        "        - flag: \"--token-auth-file\"",
        "          set: false",
        "    remediation: |",
        "      Edit the API server pod specification file and remove the --token-auth-file=<filename> parameter.",
        "      kube-apiserver-arg:",
        "        - \"enable-admission-plugins=AlwaysAdmit\""
      ]
    ],
    ["scripts/check.sh", ["ps -ef | grep kube-apiserver | grep -- --insecure-port=8080"]],
    // Other software's `anonymous` settings, and comments.
    ["grafana/values.yaml", ["auth:", "  anonymous:", "    enabled: true"]],
    ["manifests/kube-apiserver.yaml", staticPod("kube-apiserver", "# --insecure-port=8080")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testKubernetesControlPlaneSkipsTestsAndCanBeDisabled(): void {
  const lines = staticPod("kube-apiserver", "--insecure-port=8080");
  assert.deepEqual(findings([added("test/e2e/manifests/kube-apiserver.yaml", lines)]), []);
  assert.deepEqual(findings([added("examples/kube-apiserver.yaml", lines)]), []);
  assert.deepEqual(findings([added("pkg/armhelpers/httpMockClientData/deploy.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { kubernetesControlPlane: { enabled: false } } });
  assert.deepEqual(findings([added("manifests/kube-apiserver.yaml", lines)], config), []);
}
