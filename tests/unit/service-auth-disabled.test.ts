import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { serviceAuthDisabledRule } from "../../src/rules/service-auth-disabled.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return serviceAuthDisabledRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testServiceAuthDisabledReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/docker-compose.yml", [
      "services:",
      "  search:",
      "    image: elasticsearch:8.15.0",
      "    environment:",
      "      - xpack.security.enabled=false",
      "  db:",
      "    image: postgres:16",
      "    environment:",
      "      POSTGRES_HOST_AUTH_METHOD: trust"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Service authentication turned off");
  assert.deepEqual(finding?.lines, [5, 9]);
  assert.equal(
    finding?.message,
    "Lines 5, 9 turn off Elasticsearch or OpenSearch security and Postgres password checks, so anyone who can reach the service on the network can read and change its data, or, for Docker and Jupyter, run code on the host."
  );
}

export function testServiceAuthDisabledReadsEachService(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["deploy/docker.service", ["ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2375"], "high"],
    ["deploy/daemon.json", ["{ \"hosts\": [\"unix:///var/run/docker.sock\", \"tcp://0.0.0.0:2375\"] }"], "high"],
    ["Dockerfile", ["CMD [\"jupyter\", \"lab\", \"--ip=0.0.0.0\", \"--ServerApp.token=''\"]"], "high"],
    ["config/jupyter_notebook_config.py", ["c.NotebookApp.token = ''"], "high"],
    ["k8s/opensearch.yaml", ["      DISABLE_SECURITY_PLUGIN: \"true\""], "warning"],
    ["deploy/redis.conf", ["protected-mode no"], "warning"],
    ["deploy/start.sh", ["mongod --bind_ip_all --noauth"], "warning"],
    ["deploy/mongod.conf", ["security:", "  authorization: disabled"], "warning"],
    ["deploy/pg_hba.conf", ["host    all    all    0.0.0.0/0    trust"], "warning"],
    ["deploy/.env.production", ["MYSQL_ALLOW_EMPTY_PASSWORD=yes"], "warning"],
    ["deploy/my.cnf", ["[mysqld]", "skip-grant-tables"], "warning"],
    ["deploy/grafana.env", ["GF_AUTH_ANONYMOUS_ENABLED=true", "GF_AUTH_ANONYMOUS_ORG_ROLE=Admin"], "warning"],
    ["deploy/rabbitmq.conf", ["loopback_users.guest = false"], "warning"],
    ["deploy/server.properties", ["allow.everyone.if.no.acl.found=true"], "warning"],
    ["deploy/kubelet.service", ["ExecStart=/usr/bin/kubelet --anonymous-auth=true --authorization-mode=AlwaysAllow"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testServiceAuthDisabledSkipsAuthenticatedAndThrowawaySetups(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/docker-compose.yml", ["      - xpack.security.enabled=true", "      POSTGRES_PASSWORD_FILE: /run/secrets/db"]],
    ["deploy/redis.conf", ["protected-mode yes", "requirepass ${REDIS_PASSWORD}"]],
    ["deploy/docker.service", ["ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376 --tlsverify"]],
    ["deploy/pg_hba.conf", ["host    all    all    10.0.0.0/8    scram-sha-256", "local   all    all                  trust"]],
    // Other flags with similar names.
    ["deploy/calendar.sh", ["python google-calendar --noauth_local_webserver"]],
    // CI service containers, test containers, development setups, and comments.
    [".github/workflows/db-tests.yml", ["          MYSQL_ALLOW_EMPTY_PASSWORD: true"]],
    ["docker-compose.override.yml", ["      POSTGRES_HOST_AUTH_METHOD: trust"]],
    ["docker-compose.dev.yml", ["      POSTGRES_HOST_AUTH_METHOD: trust"]],
    [".devcontainer/docker-compose.yml", ["      POSTGRES_HOST_AUTH_METHOD: trust"]],
    ["testcontainers/community/elasticsearch/__init__.py", ["        return {\"xpack.security.enabled\": \"false\"}"]],
    ["deploy/redis.conf", ["# protected-mode no"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testServiceAuthDisabledSkipsTestsAndCanBeDisabled(): void {
  const line = "      POSTGRES_HOST_AUTH_METHOD: trust";
  assert.deepEqual(findings([added("test/docker-compose.yml", [line]), added("fixtures/docker-compose.yml", [line]), added("docs/setup.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { serviceAuthDisabled: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/docker-compose.yml", [line])], config), []);
}
