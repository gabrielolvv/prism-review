import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { publicLoadBalancerRule } from "../../src/rules/public-load-balancer.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return publicLoadBalancerRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const service = (annotations: string[], ...spec: string[]) => [
  "apiVersion: v1",
  "kind: Service",
  "metadata:",
  "  name: orders-db",
  ...(annotations.length > 0 ? ["  annotations:", ...annotations.map((line) => `    ${line}`)] : []),
  "spec:",
  ...spec.map((line) => `  ${line}`)
];

export function testPublicLoadBalancerReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("k8s/postgres.yaml", service([], "type: LoadBalancer", "selector:", "  app: postgres", "ports:", "  - name: postgres", "    port: 5432", "    targetPort: 5432"))
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Database or admin port on a public load balancer");
  assert.deepEqual(finding?.lines, [6]);
  assert.equal(
    finding?.message,
    "Line 6 exposes port 5432 (PostgreSQL) through a public cloud load balancer, so anyone on the internet can connect to it and try passwords, or read data if authentication is off."
  );
}

export function testPublicLoadBalancerReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    // Ports before the type, and source ranges that include the whole internet.
    ["k8s/redis.yaml", service([], "ports:", "  - port: 6379", "loadBalancerSourceRanges:", "  - 0.0.0.0/0", "type: LoadBalancer")],
    // Helm values with named ports.
    ["deploy/values-prod.yaml", ["mongodb:", "  service:", "    type: LoadBalancer", "    ports:", "      mongodb: 27017"]],
    // JSON and Terraform.
    ["k8s/es.json", ["{", "  \"kind\": \"Service\",", "  \"spec\": {", "    \"type\": \"LoadBalancer\",", "    \"ports\": [", "      { \"port\": 9200 }", "    ]", "  }", "}"]],
    [
      "infra/redis.tf",
      [
        "resource \"kubernetes_service_v1\" \"redis\" {",
        "  metadata {",
        "    name = \"redis\"",
        "  }",
        "  spec {",
        "    type = \"LoadBalancer\"",
        "    port {",
        "      port        = 6379",
        "      target_port = 6379",
        "    }",
        "  }",
        "}"
      ]
    ]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicLoadBalancerSkipsPrivateAndWebServices(): void {
  const cases: Array<[string, string[]]> = [
    // Internal load balancers and narrow source ranges.
    ["k8s/postgres.yaml", service(["service.beta.kubernetes.io/aws-load-balancer-internal: \"true\""], "type: LoadBalancer", "ports:", "  - port: 5432")],
    ["k8s/postgres.yaml", service(["networking.gke.io/load-balancer-type: \"Internal\""], "type: LoadBalancer", "ports:", "  - port: 5432")],
    ["k8s/postgres.yaml", service(["service.beta.kubernetes.io/azure-load-balancer-internal: \"true\""], "type: LoadBalancer", "ports:", "  - port: 5432")],
    ["k8s/postgres.yaml", service([], "type: LoadBalancer", "loadBalancerSourceRanges:", "  - 10.0.0.0/8", "ports:", "  - port: 5432")],
    // Web ports, ClusterIP services, and templated types.
    ["k8s/web.yaml", service([], "type: LoadBalancer", "ports:", "  - port: 443", "    targetPort: 8443")],
    ["k8s/postgres.yaml", service([], "type: ClusterIP", "ports:", "  - port: 5432")],
    ["charts/db/templates/service.yaml", service([], "type: {{ .Values.service.type }}", "ports:", "  - port: 5432")],
    // A database's own settings next to a web service.
    ["deploy/values.yaml", ["service:", "  type: LoadBalancer", "  ports:", "    http: 80", "database:", "  port: 3306"]],
    // External access a chart keeps off.
    ["deploy/values.yaml", ["externalAccess:", "  enabled: false", "  service:", "    type: LoadBalancer", "    ports:", "      mongodb: 27017"]],
    // Terraform services that are not load balancers.
    ["infra/redis.tf", ["resource \"kubernetes_service_v1\" \"redis\" {", "  spec {", "    port {", "      port = 6379", "    }", "  }", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicLoadBalancerSkipsTestsAndCanBeDisabled(): void {
  const lines = service([], "type: LoadBalancer", "ports:", "  - port: 5432");
  assert.deepEqual(findings([added("e2e-tests/service/postgres.yaml", lines)]), []);
  assert.deepEqual(findings([added("examples/postgres.yaml", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/postgres.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { publicLoadBalancer: { enabled: false } } });
  assert.deepEqual(findings([added("k8s/postgres.yaml", lines)], config), []);
}
