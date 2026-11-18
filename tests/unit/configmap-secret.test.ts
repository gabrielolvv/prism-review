import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { configMapSecretRule } from "../../src/rules/configmap-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return configMapSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const configMap = (...data: string[]) => ["apiVersion: v1", "kind: ConfigMap", "metadata:", "  name: orders", "data:", ...data];

export function testConfigMapSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(
      "deploy/orders-config.yaml",
      configMap("  LOG_LEVEL: info", "  DB_USER: orders", "  DB_PASSWORD: \"Tr0ub4dor-orders\"", "  application.properties: |", "    server.port=8080", "    spring.datasource.password=Kq8vRz2mWx")
    )
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Secret kept in a ConfigMap");
  assert.deepEqual(finding?.lines, [8, 11]);
  assert.equal(
    finding?.message,
    "Lines 8, 11 put values for `DB_PASSWORD` and `application.properties: password` in a Kubernetes ConfigMap committed to the repository. Anyone who can read the repository can read them, and in the cluster ConfigMaps are readable by more roles than Secrets, such as the built-in `view` role, and are left out of encryption at rest."
  );
}

export function testConfigMapSecretReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    // Config files kept in the ConfigMap: YAML, JSON, and .env.
    ["k8s/app.yaml", configMap("  config.yaml: |", "    redis:", "      host: redis", "      password: Kq8vRz2mWx")],
    ["k8s/app.yaml", configMap("  settings.json: |", "    {", "      \"stripeApiKey\": \"Kq8vRz2mWxLp4T\",", "      \"region\": \"eu\"", "    }")],
    ["k8s/app.yaml", configMap("  app.env: |", "    export API_TOKEN=Kq8vRz2mWxLp4T")],
    // A ConfigMap after another document.
    ["k8s/app.yaml", ["apiVersion: apps/v1", "kind: Deployment", "metadata:", "  name: orders", "---", ...configMap("  admin_password: Kq8vRz2mWx")]],
    // Kustomize's ConfigMap generator.
    ["overlays/prod/kustomization.yaml", ["configMapGenerator:", "  - name: orders", "    literals:", "      - LOG_LEVEL=info", "      - SMTP_PASSWORD=Kq8vRz2mWx"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testConfigMapSecretSkipsReferencesAndPlaceholders(): void {
  const cases: Array<[string, string[]]> = [
    // Templated values, placeholders, and settings that are not credentials.
    ["k8s/app.yaml", configMap("  DB_PASSWORD: {{ .Values.db.password | quote }}", "  API_TOKEN: ${API_TOKEN}", "  SMTP_PASSWORD: changeme")],
    ["k8s/app.yaml", configMap("  DB_USER: orders", "  TOKEN_URL: https://auth.acme.io/token", "  PASSWORD_MIN_LENGTH: \"12\"")],
    // Names of Secrets and of keys in them.
    ["k8s/app.yaml", configMap("  credentialsSecret: jaeger-creds", "  existingSecret: orders-db")],
    ["base/kustomization.yaml", ["configMapGenerator:", "  - name: ui", "    literals:", "      - secretKey=signing-secret"]],
    // A base64-encoded sample value.
    ["k8s/dex.yaml", configMap("  config.yaml: |", "    staticClients:", "      - id: example-app", "        secret: ZXhhbXBsZS1hcHAtc2VjcmV0")],
    // Secrets, which kubernetes-secret-values reads, and comments.
    ["k8s/app.yaml", ["apiVersion: v1", "kind: Secret", "metadata:", "  name: orders", "stringData:", "  DB_PASSWORD: Tr0ub4dor-orders"]],
    ["k8s/app.yaml", configMap("  app.env: |", "    # API_TOKEN=Kq8vRz2mWxLp4T")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }

  // A credential already in the ConfigMap, outside the change.
  const edited: ChangedFile = {
    path: "k8s/app.yaml",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: ["@@ -4,3 +4,3 @@", " data:", "-  LOG_LEVEL: info", "+  LOG_LEVEL: debug", "   DB_PASSWORD: Tr0ub4dor-orders"].join("\n")
  };
  assert.deepEqual(findings([edited]), []);
}

export function testConfigMapSecretFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `password: ...`, so the ConfigMap is read first.
  const files = prepareChangedFiles([added("deploy/orders-config.yaml", configMap("  config.yaml: |", "    password: Tr0ub4dor-orders"))], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "configmap-secret");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [7]);
}

export function testConfigMapSecretSkipsTestsAndCanBeDisabled(): void {
  const lines = configMap("  DB_PASSWORD: Tr0ub4dor-orders");
  assert.deepEqual(findings([added("test/e2e/manifests/orders.yaml", lines)]), []);
  assert.deepEqual(findings([added("examples/orders/configmap.yaml", lines)]), []);
  assert.deepEqual(findings([added("docs/configmap.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { configMapSecret: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/orders.yaml", lines)], config), []);
}
