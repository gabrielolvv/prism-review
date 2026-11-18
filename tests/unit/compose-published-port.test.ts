import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { composePublishedPortRule } from "../../src/rules/compose-published-port.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return composePublishedPortRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const compose = (...ports: string[]) => ["services:", "  db:", "    image: postgres:16", "    ports:", ...ports.map((port) => `      ${port}`), "  web:", "    image: acme/web:1.4", "    ports:", "      - \"80:80\""];

export function testComposePublishedPortReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("docker-compose.prod.yml", compose("- \"5432:5432\"", "- \"0.0.0.0:6379:6379\""))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Database or admin port published on every interface");
  assert.deepEqual(finding?.lines, [5, 6]);
  assert.equal(
    finding?.message,
    "Lines 5, 6 publish ports 5432 (PostgreSQL) and 6379 (Redis) on every network interface of the host. Docker opens published ports past host firewalls such as ufw and firewalld, so unless something in front of the host blocks them, anyone on the internet can connect."
  );
}

export function testComposePublishedPortReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    // A different host port, the container port alone, a variable host port, and a range.
    ["deploy/docker-compose.yml", compose("- 13306:3306")],
    ["deploy/docker-compose.yml", compose("- \"9200\"")],
    ["deploy/docker-compose.yml", compose("- \"${DB_PORT:-5432}:5432\"")],
    ["deploy/docker-compose.yml", compose("- \"9200-9300:9200-9300\"")],
    ["deploy/docker-compose.yml", compose("- \"[::]:27017:27017/tcp\"")],
    // The long syntax, and a Swarm stack file.
    ["deploy/docker-compose.yml", compose("- target: 6379", "  published: 6379", "  mode: host")],
    ["stack/app.yml", ["version: \"3.8\"", "services:", "  kafka:", "    image: bitnami/kafka:3.7", "    ports:", "      - \"9092:9092\""]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testComposePublishedPortSkipsPrivateBindingsAndDevelopment(): void {
  const cases: Array<[string, string[]]> = [
    // Loopback, private, and variable addresses.
    ["docker-compose.prod.yml", compose("- \"127.0.0.1:5432:5432\"")],
    ["docker-compose.prod.yml", compose("- \"[::1]:5432:5432\"")],
    ["docker-compose.prod.yml", compose("- \"10.0.1.5:6379:6379\"")],
    ["docker-compose.prod.yml", compose("- \"${BIND_ADDRESS}:6379:6379\"")],
    ["docker-compose.prod.yml", compose("- target: 5432", "  published: 5432", "  host_ip: 127.0.0.1")],
    // Web ports, a container port given as a variable, and `expose`.
    ["docker-compose.prod.yml", compose("- \"8080:8080\"")],
    ["docker-compose.prod.yml", compose("- \"5432:${DB_PORT}\"")],
    ["docker-compose.prod.yml", ["services:", "  db:", "    image: postgres:16", "    expose:", "      - \"5432\""]],
    // Development Compose files, overrides, and Kubernetes manifests.
    ["docker-compose.yml", compose("- \"5432:5432\"")],
    ["deploy/docker-compose.override.yml", compose("- \"5432:5432\"")],
    ["deploy/docker-compose.dev.yml", compose("- \"5432:5432\"")],
    ["deploy/k8s/postgres.yaml", ["kind: Pod", "spec:", "  containers:", "    - name: db", "      ports:", "        - 5432"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testComposePublishedPortSkipsTestsAndCanBeDisabled(): void {
  const lines = compose("- \"5432:5432\"");
  assert.deepEqual(findings([added("test/fixtures/deploy/docker-compose.yml", lines)]), []);
  assert.deepEqual(findings([added("deploy/docker-compose.test.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { composePublishedPort: { enabled: false } } });
  assert.deepEqual(findings([added("docker-compose.prod.yml", lines)], config), []);
}
