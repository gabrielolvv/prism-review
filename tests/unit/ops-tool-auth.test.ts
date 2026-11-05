import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { opsToolAuthRule } from "../../src/rules/ops-tool-auth.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return opsToolAuthRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testOpsToolAuthReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/monitoring/prometheus.yaml", [
      "containers:",
      "  - name: prometheus",
      "    args:",
      "      - --config.file=/etc/prometheus/prometheus.yml",
      "      - --web.enable-admin-api",
      "  - name: dashboard",
      "    args:",
      "      - --enable-skip-login"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Operations tool open without login");
  assert.deepEqual(finding?.lines, [5, 8]);
  assert.equal(
    finding?.message,
    "Lines 5, 8 open Prometheus's admin API and the Kubernetes Dashboard without its login to anyone who can reach them, and these tools deploy code, run scripts, read secrets, or delete data."
  );
}

export function testOpsToolAuthReportsCodeExecutionAsHigh(): void {
  const [finding] = findings([added("jenkins/casc.yaml", ["jenkins:", "  authorizationStrategy: unsecured"])]);

  assert.equal(finding?.severity, "high");
  assert.equal(
    finding?.message,
    "Line 2 opens Jenkins with its security turned off to anyone who can reach it, and these tools deploy code, run scripts, read secrets, or delete data."
  );
}

export function testOpsToolAuthReadsEachTool(): void {
  const cases: Array<[string, string[]]> = [
    ["jenkins/config.xml", ["  <useSecurity>false</useSecurity>"]],
    ["jenkins/config.xml", ["  <authorizationStrategy class=\"hudson.security.AuthorizationStrategy$Unsecured\"/>"]],
    ["airflow/webserver_config.py", ["AUTH_ROLE_PUBLIC = 'Admin'"]],
    ["superset/superset_config.py", ["AUTH_ROLE_PUBLIC = \"Admin\""]],
    ["deploy/vault.yaml", ["command: vault server -dev -dev-listen-address=0.0.0.0:8200"]],
    ["deploy/vault.yaml", ["args: [\"server\", \"-dev\"]"]],
    ["docker-compose.yml", ["    environment:", "      VAULT_DEV_ROOT_TOKEN_ID: root"]],
    ["charts/vault/values.yaml", ["server:", "  dev:", "    enabled: true"]],
    ["charts/dashboard/values.yaml", ["enableInsecureLogin: true"]],
    ["deploy/argocd/argocd-cm.yaml", ["data:", "  users.anonymous.enabled: \"true\""]],
    ["deploy/argocd/argocd-cmd-params-cm.yaml", ["data:", "  server.disable.auth: \"true\""]],
    ["charts/monitoring/values.yaml", ["prometheus:", "  prometheusSpec:", "    enableAdminAPI: true"]],
    ["consul/server.hcl", ["acl {", "  enabled = true", "  default_policy = \"allow\"", "}"]],
    ["traefik/traefik.yml", ["api:", "  insecure: true"]],
    ["traefik/traefik.toml", ["[api]", "  insecure = true"]],
    ["docker-compose.yml", ["    command: --api.insecure=true --providers.docker"]],
    ["docker-compose.yml", ["    environment:", "      - ALLOW_NONE_AUTHENTICATION=yes"]],
    ["docker-compose.yml", ["    environment:", "      KONG_ADMIN_LISTEN: 0.0.0.0:8001"]],
    ["deploy/etcd.yaml", ["          env:", "            - name: ALLOW_NONE_AUTHENTICATION", "              value: \"yes\""]],
    ["deploy/vault.yaml", ["          env:", "            - name: VAULT_DEV_ROOT_TOKEN_ID", "              value: root"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testOpsToolAuthSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Login kept on, or the API bound to localhost.
    ["jenkins/casc.yaml", ["jenkins:", "  authorizationStrategy:", "    loggedInUsersCanDoAnything:", "      allowAnonymousRead: false"]],
    ["airflow/webserver_config.py", ["AUTH_ROLE_PUBLIC = 'Public'"]],
    ["deploy/dashboard.yaml", ["      - --enable-skip-login=false"]],
    ["consul/server.hcl", ["acl {", "  default_policy = \"deny\"", "}"]],
    ["docker-compose.yml", ["      KONG_ADMIN_LISTEN: 127.0.0.1:8001"]],
    ["traefik/traefik.yml", ["api:", "  dashboard: true", "  insecure: false"]],
    // The same keys in other tools, and flag descriptions.
    ["deploy/app/values.yaml", ["tls:", "  insecure: true"]],
    ["charts/app/values.yaml", ["dev:", "  enabled: true"]],
    ["deploy/policy.yaml", ["default_policy: allow"]],
    ["cmd/flags.yaml", ["- name: --web.enable-admin-api", "  description: --web.enable-admin-api turns on the admin API"]],
    // Development setups, CI, comments, and documentation.
    ["deploy/dev/vault.yaml", ["command: vault server -dev"]],
    ["charts/vault/templates/_helpers.tpl", ["  {{ else if eq .mode \"dev\" }}", "          - |", "            vault server -dev {{ .Values.server.extraArgs }}"]],
    ["Makefile", ["\tVAULT_DEV_ROOT_TOKEN_ID= \\"]],
    ["charts/vault/templates/_helpers.tpl", ["  {{ if eq .mode \"dev\" }}", "            - name: VAULT_DEV_ROOT_TOKEN_ID", "              value: {{ .Values.server.dev.devRootToken }}"]],
    ["e2e/docker-compose.yml", ["      - ALLOW_NONE_AUTHENTICATION=yes"]],
    ["hack/observability/prometheus.yaml", ["      - --web.enable-admin-api"]],
    ["docs/operator-manual/argocd-cm.yaml", ["  users.anonymous.enabled: \"true\""]],
    ["examples/argocd/argocd-cm.yaml", ["  users.anonymous.enabled: \"true\""]],
    [".github/workflows/e2e.yml", ["        options: vault server -dev"]],
    ["deploy/monitoring/prometheus.yaml", ["      # - --web.enable-admin-api"]],
    ["docs/vault.md", ["vault server -dev"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testOpsToolAuthSkipsTestsAndCanBeDisabled(): void {
  const lines = ["command: vault server -dev"];
  assert.deepEqual(findings([added("test/e2e/vault.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { opsToolAuth: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/vault.yaml", lines)], config), []);
}
