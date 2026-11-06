import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { deploymentEnvSecretRule } from "../../src/rules/deployment-env-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return deploymentEnvSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const container = (...env: string[]) => ["apiVersion: apps/v1", "kind: Deployment", "spec:", "  template:", "    spec:", "      containers:", "        - name: app", "          image: acme/app:1.4.2", "          env:", ...env];

export function testDeploymentEnvSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/app.yaml", container("            - name: LOG_LEVEL", "              value: info", "            - name: DB_PASSWORD", "              value: \"Tr0ub4dor-staging\""))
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Secret written into a deployment's environment");
  assert.deepEqual(finding?.lines, [13]);
  assert.equal(
    finding?.message,
    "Line 13 writes `DB_PASSWORD` into a deployment's environment in plain text, so the secret is committed to the repository, where anyone who can read it, a fork, or its history can use it, and shows to anyone who can read the deployment, such as with `kubectl describe` or in the ECS console."
  );
  assert.doesNotMatch(finding?.message ?? "", /Tr0ub4dor/);
}

export function testDeploymentEnvSecretReadsEachFormat(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/app.yaml", container("            - { name: STRIPE_API_KEY, value: Tr0ub4dor-staging }")],
    ["infra/task-definition.json", ["{", "  \"containerDefinitions\": [{", "    \"environment\": [", "      { \"name\": \"JWT_SECRET\", \"value\": \"Tr0ub4dor-staging\" }", "    ]", "  }]", "}"]],
    ["infra/ecs.tf", ["  container_definitions = jsonencode([{", "    environment = [", "      {", "        name  = \"API_TOKEN\"", "        value = \"Tr0ub4dor-staging\"", "      }", "    ]", "  }])"]],
    ["deploy/docker-compose.prod.yml", ["services:", "  api:", "    image: acme/api:1.4.2", "    environment:", "      SESSION_SECRET: Tr0ub4dor-staging"]],
    ["deploy/docker-compose.prod.yml", ["services:", "  api:", "    environment:", "      - SMTP_PASSWORD=Tr0ub4dor-staging"]],
    ["app.yaml", ["runtime: python312", "env_variables:", "  SECRET_KEY: \"Tr0ub4dor-staging\""]],
    ["charts/api/values.yaml", ["replicaCount: 2", "env:", "  GITHUB_TOKEN: Tr0ub4dor-staging"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testDeploymentEnvSecretSkipsReferencesAndPlaceholders(): void {
  const cases: Array<[string, string[]]> = [
    // Secret references, templates, and variables read from elsewhere.
    ["deploy/app.yaml", container("            - name: DB_PASSWORD", "              valueFrom:", "                secretKeyRef:", "                  name: db", "                  key: password")],
    ["deploy/app.yaml", container("            - name: DB_PASSWORD", "              value: {{ .Values.db.password | quote }}")],
    ["deploy/app.yaml", container("            - name: DB_PASSWORD", "              value: $(POSTGRES_PASSWORD)")],
    ["infra/task-definition.json", ["\"environment\": [", "  { \"name\": \"API_TOKEN\", \"value\": \"arn:aws:secretsmanager:us-east-1:123456789012:secret:api\" }"]],
    ["deploy/docker-compose.prod.yml", ["services:", "  api:", "    environment:", "      SESSION_SECRET: ${SESSION_SECRET}"]],
    // Placeholders, local defaults, settings about secrets, and other variables.
    ["deploy/app.yaml", container("            - name: DB_PASSWORD", "              value: changeme")],
    ["deploy/app.yaml", container("            - name: DB_PASSWORD", "              value: postgres")],
    ["deploy/app.yaml", container("            - name: TOKEN_TTL_SECONDS", "              value: \"3600\"")],
    ["deploy/app.yaml", container("            - name: DB_PASSWORD_FILE", "              value: /run/secrets/db-password")],
    ["deploy/app.yaml", container("            - name: LOG_LEVEL", "              value: debug")],
    // `name` and `value` pairs outside an environment list.
    ["deploy/labels.yaml", ["metadata:", "  annotations:", "    - name: API_TOKEN", "      value: Tr0ub4dor-staging"]],
    // Development Compose files, examples, CI, and documentation.
    ["docker-compose.yml", ["services:", "  db:", "    environment:", "      POSTGRES_PASSWORD: Tr0ub4dor-staging"]],
    ["examples/app.yaml", container("            - name: DB_PASSWORD", "              value: Tr0ub4dor-staging")],
    ["design/poc/minio.yaml", container("            - name: MINIO_ROOT_PASSWORD", "              value: Tr0ub4dor-staging")],
    [".github/workflows/e2e.yaml", ["env:", "  API_TOKEN: Tr0ub4dor-staging"]],
    ["appveyor.yml", ["environment:", "  SQLPASSWORD: Tr0ub4dor-staging"]],
    ["roles/db/molecule/default/create.yml", ["environment:", "  POSTGRES_PASSWORD: Tr0ub4dor-staging"]],
    ["docs/deploy.md", container("            - name: DB_PASSWORD", "              value: Tr0ub4dor-staging")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testDeploymentEnvSecretFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `SECRET_KEY: ...`, so the variables are read first.
  const files = prepareChangedFiles([added("deploy/docker-compose.prod.yml", ["services:", "  api:", "    environment:", "      SECRET_KEY: Tr0ub4dor-staging"])], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "deployment-env-secret");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [4]);
}

export function testDeploymentEnvSecretSkipsTestsAndCanBeDisabled(): void {
  const lines = container("            - name: DB_PASSWORD", "              value: Tr0ub4dor-staging");
  assert.deepEqual(findings([added("test/e2e/app.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { deploymentEnvSecret: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/app.yaml", lines)], config), []);
}
