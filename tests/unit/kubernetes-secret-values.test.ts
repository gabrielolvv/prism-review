import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { kubernetesSecretValuesRule } from "../../src/rules/kubernetes-secret-values.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return kubernetesSecretValuesRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const secret = (...body: string[]) => ["apiVersion: v1", "kind: Secret", "metadata:", "  name: db", "type: Opaque", ...body];

export function testKubernetesSecretValuesReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("deploy/db-secret.yaml", secret("data:", "  username: YXBwLXVzZXI=", "  password: VHIwdWI0ZG9yLXN0YWdpbmc=", "  api-token: VHIwdWI0ZG9yLXN0YWdpbmc="))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Kubernetes Secret committed with its values");
  assert.deepEqual(finding?.lines, [8, 9]);
  assert.equal(
    finding?.message,
    "Lines 8, 9 put values for `password` and `api-token` in a Kubernetes Secret committed to the repository. Secret data is only base64-encoded, not encrypted, so anyone who can read the repository, a fork, or its history can read these values and use them."
  );
  // The message names keys, never values.
  assert.doesNotMatch(finding?.message ?? "", /VHIw|Tr0ub4dor/);
}

export function testKubernetesSecretValuesReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/db-secret.yaml", secret("stringData:", "  DATABASE_PASSWORD: \"Tr0ub4dor-staging\"")],
    ["deploy/app.yaml", ["apiVersion: apps/v1", "kind: Deployment", "metadata:", "  name: app", "---", ...secret("stringData:", "  config.yaml: |", "    password: Tr0ub4dor-staging")]],
    ["deploy/app-secret.yaml", secret("data:", "  DATABASE_URL: cG9zdGdyZXM6Ly9hcHA6VHIwdWI0ZG9yLXN0YWdpbmdAZGI6NTQzMi9hcHA=")],
    ["deploy/tls.yaml", secret("stringData:", "  tls.key: |", "    -----BEGIN EC PRIVATE KEY-----", "    MHcCAQEEIBkg", "    -----END EC PRIVATE KEY-----")],
    ["k8s/overlays/prod/kustomization.yaml", ["resources:", "  - ../../base", "secretGenerator:", "  - name: db", "    literals:", "      - DB_PASSWORD=Tr0ub4dor-staging"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testKubernetesSecretValuesSkipsPlaceholdersAndEncryptedSecrets(): void {
  const cases: Array<[string, string[]]> = [
    // Empty, templated, and placeholder values, plain and base64-encoded.
    ["deploy/db-secret.yaml", secret("data:", "  password: \"\"")],
    ["deploy/db-secret.yaml", secret("data:", "  password: Y2hhbmdlbWU=")],
    ["deploy/db-secret.yaml", secret("stringData:", "  password: <your-password>")],
    ["deploy/backup-secret.yaml", secret("data:", "  AWS_SECRET_ACCESS_KEY: UkVQTEFDRS1XSVRILUFXUy1TRUNSRVQtS0VZ")],
    ["deploy/minio-secret.yaml", secret("stringData:", "  secretkey: myXXXXxxxx/secretXXXX")],
    // Keys whose values are not secret on their own, and config without credentials.
    ["deploy/db-secret.yaml", secret("stringData:", "  username: app-user", "  host: db.internal", "  tls.crt: |", "    -----BEGIN CERTIFICATE-----", "    MIIBszCCAVmgAwIBAgIU", "    -----END CERTIFICATE-----")],
    ["deploy/app-secret.yaml", secret("stringData:", "  config.yaml: |", "    logLevel: info", "    password: ${APP_PASSWORD}")],
    ["charts/app/templates/kubeconfig.yaml", secret("stringData:", "  {{ .Release.Name }}-kubeconfig: |-", "    apiVersion: v1", "    kind: Config", "    users:", "      - user:", "          token: {{ .Values.token }}")],
    ["deploy/db-secret.yaml", secret("stringData:", "  password: ${DB_PASSWORD}")],
    ["charts/app/templates/secret.yaml", secret("data:", "  password: {{ .Values.db.password | b64enc | quote }}")],
    // SOPS-encrypted Secrets, Sealed Secrets, and service account tokens.
    ["deploy/db-secret.yaml", secret("stringData:", "  password: ENC[AES256_GCM,data:abc,iv:def,tag:ghi,type:str]", "sops:", "  version: 3.9.0")],
    ["deploy/db-sealed.yaml", ["apiVersion: bitnami.com/v1alpha1", "kind: SealedSecret", "spec:", "  encryptedData:", "    password: AgBy3i4OJSWK+PiTySYZZA=="]],
    ["deploy/token.yaml", ["apiVersion: v1", "kind: Secret", "type: kubernetes.io/service-account-token", "data:", "  token: ZXlKaGJHY2lPaUpTVXpJMU5pSjk="]],
    // Other kinds with `data`, and Kustomize generators that read files.
    ["deploy/config.yaml", ["apiVersion: v1", "kind: ConfigMap", "data:", "  LOG_LEVEL: debug"]],
    ["k8s/base/kustomization.yaml", ["secretGenerator:", "  - name: db", "    envs:", "      - db.env"]],
    // Examples, samples, development overlays, and documentation.
    ["examples/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging")],
    ["manifests/quick-start/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging")],
    ["integrationtests/assets/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging")],
    ["config/samples/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging")],
    ["k8s/overlays/dev/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging")],
    ["docs/secrets.md", secret("stringData:", "  password: Tr0ub4dor-staging")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testKubernetesSecretValuesFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `password: ...` and long base64 values, so the Secret is read first.
  const files = prepareChangedFiles([added("deploy/db-secret.yaml", secret("stringData:", "  password: Tr0ub4dor-staging"))], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "kubernetes-secret-values");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [7]);
}

export function testKubernetesSecretValuesSkipsTestsAndCanBeDisabled(): void {
  const lines = secret("stringData:", "  password: Tr0ub4dor-staging");
  assert.deepEqual(findings([added("test/e2e/manifests/db-secret.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { kubernetesSecretValues: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/db-secret.yaml", lines)], config), []);
}
