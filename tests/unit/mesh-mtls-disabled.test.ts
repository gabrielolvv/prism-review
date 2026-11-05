import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { meshMtlsDisabledRule } from "../../src/rules/mesh-mtls-disabled.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return meshMtlsDisabledRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const peerAuthentication = (mode: string): string[] => [
  "apiVersion: security.istio.io/v1",
  "kind: PeerAuthentication",
  "metadata:",
  "  name: default",
  "  namespace: istio-system",
  "spec:",
  "  mtls:",
  `    mode: ${mode}`
];

export function testMeshMtlsDisabledReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/mesh/peer-authentication.yaml", [...peerAuthentication("PERMISSIVE"), "  portLevelMtls:", "    \"9090\":", "      mode: DISABLE"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Service mesh mutual TLS weakened");
  assert.deepEqual(finding?.lines, [8, 11]);
  assert.equal(
    finding?.message,
    "Lines 8, 11 set the service mesh so that it turns mutual TLS off and accepts plaintext next to mutual TLS, so traffic between services can be read or changed on the network, and any pod, including one an attacker controls, can call these services without a mesh identity that authorization policies check."
  );
}

export function testMeshMtlsDisabledReadsEachMesh(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/mesh/peer-authentication.yaml", peerAuthentication("DISABLE")],
    ["deploy/mesh/peer-authentication.yaml", peerAuthentication("\"PERMISSIVE\"")],
    [
      "deploy/mesh/destination-rule.yaml",
      ["kind: DestinationRule", "spec:", "  host: payments.prod.svc.cluster.local", "  trafficPolicy:", "    tls:", "      mode: DISABLE"]
    ],
    ["deploy/mesh/destination-rule.yaml", ["kind: DestinationRule", "spec:", "  host: payments", "  trafficPolicy:", "    tls:", "      mode: DISABLE"]],
    ["charts/istio/values.yaml", ["meshConfig:", "  enableAutoMtls: false"]],
    ["istio/configmap.yaml", ["kind: ConfigMap", "data:", "  mesh: |-", "    defaultConfig:", "      discoveryAddress: istiod:15012", "    enableAutoMtls: false"]],
    ["consul/service-defaults.hcl", ["Kind = \"service-defaults\"", "Name = \"web\"", "MutualTLSMode = \"permissive\""]],
    ["consul/mesh.yaml", ["kind: Mesh", "spec:", "  allowEnablingPermissiveMutualTLS: true"]],
    ["kuma/mesh.yaml", ["apiVersion: kuma.io/v1alpha1", "kind: Mesh", "spec:", "  mtls:", "    enabledBackend: ca-1", "    backends:", "      - name: ca-1", "        type: builtin", "        mode: PERMISSIVE"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testMeshMtlsDisabledSkipsStrictMeshes(): void {
  const cases: Array<[string, string[]]> = [
    // Strict mutual TLS, and the mode of other resources.
    ["deploy/mesh/peer-authentication.yaml", peerAuthentication("STRICT")],
    ["deploy/mesh/peer-authentication.yaml", peerAuthentication("UNSET")],
    ["deploy/mesh/gateway.yaml", ["kind: Gateway", "spec:", "  servers:", "    - tls:", "        mode: PASSTHROUGH"]],
    ["deploy/app/config.yaml", ["mtls:", "  mode: DISABLE"]],
    // DestinationRules for external hosts that only speak plaintext.
    ["deploy/mesh/external.yaml", ["kind: DestinationRule", "spec:", "  host: api.partner.example.com", "  trafficPolicy:", "    tls:", "      mode: DISABLE"]],
    ["deploy/mesh/destination-rule.yaml", ["kind: DestinationRule", "spec:", "  host: payments", "  trafficPolicy:", "    tls:", "      mode: ISTIO_MUTUAL"]],
    ["deploy/mesh/external.yaml", ["kind: DestinationRule", "spec:", "  host: httpbin.org", "  trafficPolicy:", "    tls:", "      mode: DISABLE"]],
    ["consul/service-defaults.hcl", ["MutualTLSMode = \"strict\""]],
    ["charts/istio/values.yaml", ["meshConfig:", "  enableAutoMtls: true"]],
    ["charts/gateway/values.yaml", ["istioIntegration:", "  enabled: false", "  enableAutoMtls: false"]],
    ["config/crd/consul.hashicorp.com_meshes.yaml", ["                description: |-", "                  MutualTLSMode=permissive in either service-defaults or proxy-defaults."]],
    // Development and example clusters, comments, and documentation.
    ["deploy/dev/peer-authentication.yaml", peerAuthentication("PERMISSIVE")],
    ["samples/bookinfo/peer-authentication.yaml", peerAuthentication("DISABLE")],
    ["deploy/mesh/peer-authentication.yaml", [...peerAuthentication("STRICT").slice(0, 7), "    # mode: DISABLE"]],
    ["docs/mtls.md", peerAuthentication("DISABLE")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testMeshMtlsDisabledSkipsTestsAndCanBeDisabled(): void {
  const lines = peerAuthentication("DISABLE");
  assert.deepEqual(findings([added("tests/integration/peer-authentication.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { meshMtlsDisabled: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/mesh/peer-authentication.yaml", lines)], config), []);
}
