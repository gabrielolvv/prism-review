import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unpinnedDeployImageRule } from "../../src/rules/unpinned-deploy-image.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unpinnedDeployImageRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUnpinnedDeployImageReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("k8s/api.yaml", [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "spec:",
      "  template:",
      "    spec:",
      "      initContainers:",
      "        - name: wait",
      "          image: busybox",
      "      containers:",
      "        - name: api",
      "          image: ghcr.io/acme/api:latest",
      "        - name: proxy",
      "          image: envoyproxy/envoy:v1.31.2"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Deployment runs an unpinned image");
  assert.deepEqual(finding?.lines, [8, 11]);
  assert.equal(
    finding?.message,
    "Lines 8, 11 run `busybox` and `ghcr.io/acme/api:latest` without a fixed version, so each restart or new node can pull a different image, including one a compromised registry account pushed, and a rollback cannot return to the image that ran before."
  );
}

export function testUnpinnedDeployImageReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/docker-compose.prod.yml", ["services:", "  cache:", "    image: redis"]],
    ["deploy/task-definition.json", ["{", "  \"containerDefinitions\": [", "    { \"name\": \"web\", \"image\": \"123456789012.dkr.ecr.us-east-1.amazonaws.com/web:latest\" }", "  ]", "}"]],
    ["deploy/service.yaml", ["apiVersion: serving.knative.dev/v1", "kind: Service", "spec:", "  template:", "    spec:", "      containers:", "        - image: gcr.io/acme/web"]],
    ["infra/app.tf", ["resource \"kubernetes_deployment\" \"web\" {", "  spec {", "    container {", "      image = \"nginx:latest\"", "    }", "  }", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnpinnedDeployImageSkipsPinnedImages(): void {
  const cases: Array<[string, string[]]> = [
    // Version tags, digests, and template or variable references.
    ["k8s/api.yaml", ["kind: Deployment", "      containers:", "        - image: ghcr.io/acme/api:1.4.2", "        - image: nginx@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"]],
    ["charts/api/templates/deployment.yaml", ["kind: Deployment", "          image: \"{{ .Values.image.repository }}:{{ .Values.image.tag }}\""]],
    ["docker-compose.yml", ["services:", "  api:", "    image: ${API_IMAGE}"]],
    ["infra/app.tf", ["resource \"kubernetes_deployment\" \"web\" {", "      image = var.image", "}"]],
    // Images whose tag or registry is set next to them, ko references, and block text.
    ["charts/ingress/values.yaml", ["kind: Deployment", "  image: ingress-nginx/controller", "  tag: \"v1.11.3\""]],
    ["config/serving/controller.yaml", ["kind: Deployment", "        - image: ko://knative.dev/serving/cmd/controller"]],
    ["cfg/policies.yaml", ["kind: Pod", "    remediation: |", "      spec:", "        containers:", "          - image: example:latest"]],
    // Kustomize bases and kubebuilder config, whose overlays set the image.
    ["manifests/base/server-deployment.yaml", ["kind: Deployment", "        - image: quay.io/acme/server:latest"]],
    ["config/manager/manager.yaml", ["kind: Deployment", "        - image: controller:latest"]],
    // Compose files outside production paths, which set up a developer's machine.
    ["docker-compose.yml", ["services:", "  cache:", "    image: redis"]],
    ["docker/docker-compose/docker-compose.yml", ["services:", "  grafana:", "    image: grafana/grafana:latest", "    configs:", "      - source: datasources", "configs:", "  datasources:", "    content: |", "      apiVersion: 1"]],
    // Benchmarks and design notes.
    ["internal/bench/docker-compose.prod.yaml", ["services:", "  db:", "    image: postgres"]],
    // Files that do not deploy, such as a tool's own settings.
    ["config/renderer.yaml", ["image: true", "format: png"]],
    // CI, dev containers, development Compose files, examples, and documentation.
    [".github/workflows/ci.yml", ["jobs:", "  test:", "    services:", "      redis:", "        image: redis"]],
    ["docker-compose.override.yml", ["services:", "  api:", "    image: acme/api:latest"]],
    ["docker-compose.dev.yml", ["services:", "  api:", "    image: acme/api:latest"]],
    ["examples/guestbook/deployment.yaml", ["kind: Deployment", "        - image: redis"]],
    ["docs/deploy.md", ["kind: Deployment", "        - image: redis"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnpinnedDeployImageSkipsTestsAndCanBeDisabled(): void {
  const lines = ["kind: Deployment", "        - image: redis"];
  assert.deepEqual(findings([added("test/fixtures/deployment.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { unpinnedDeployImage: { enabled: false } } });
  assert.deepEqual(findings([added("k8s/deployment.yaml", lines)], config), []);
}
