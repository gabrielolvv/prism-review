import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { brokerPlaintextAuthRule } from "../../src/rules/broker-plaintext-auth.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return brokerPlaintextAuthRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testBrokerPlaintextAuthReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/resources/application.properties", [
      "spring.kafka.bootstrap-servers=kafka.prod.acme.io:9092",
      "spring.kafka.properties.security.protocol=SASL_PLAINTEXT",
      "spring.kafka.properties.sasl.mechanism=SCRAM-SHA-512",
      "spring.rabbitmq.addresses=amqp://app:${RABBIT_PASSWORD}@rabbit.prod.acme.io:5672"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Broker login without TLS");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 log in to Kafka and RabbitMQ over a connection without TLS, so anyone on the network path can read the password or token and use it to read, publish, or delete messages and data."
  );
}

export function testBrokerPlaintextAuthReadsEachBroker(): void {
  const cases: Array<[string, string[]]> = [
    ["config/consumer.py", ["consumer = KafkaConsumer(", "    security_protocol=\"SASL_PLAINTEXT\",", "    sasl_mechanism=\"PLAIN\",", ")"]],
    ["src/main/java/Config.java", ["props.put(CommonClientConfigs.SECURITY_PROTOCOL_CONFIG, \"SASL_PLAINTEXT\");"]],
    ["deploy/kafka.yaml", ["    env:", "      - name: KAFKA_SECURITY_PROTOCOL", "        value: SASL_PLAINTEXT", "      KAFKA_SECURITY_PROTOCOL: SASL_PLAINTEXT"]],
    ["config/server.properties", ["advertised.listeners=SASL_PLAINTEXT://kafka.prod.acme.io:9092"]],
    ["config/server.properties", ["listener.security.protocol.map=CLIENT:SASL_PLAINTEXT,CONTROLLER:PLAINTEXT"]],
    ["src/kafka.ts", ["const kafka = new Kafka({", "  brokers: ['kafka.prod.acme.io:9092'],", "  ssl: false,", "  sasl: { mechanism: 'scram-sha-256', username, password },", "});"]],
    ["src/cache.ts", ["const redis = new Redis(\"redis://:s3cret@cache.prod.acme.io:6379/0\");"]],
    ["settings.py", ["CELERY_BROKER_URL = 'amqp://app:pass@10.0.4.12:5672//'"]],
    ["src/nats.go", ["\tnc, err := nats.Connect(\"nats://app:pass@nats.prod.acme.io:4222\")"]],
    ["src/mqtt.js", ["const client = mqtt.connect('mqtt://broker.prod.acme.io', {", "  username: 'device',", "  password: process.env.MQTT_PASSWORD,", "});"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testBrokerPlaintextAuthSkipsSafeConnections(): void {
  const cases: Array<[string, string[]]> = [
    // TLS, Kerberos, and connections without a password.
    ["src/main/resources/application.properties", ["spring.kafka.properties.security.protocol=SASL_SSL"]],
    ["config/client.properties", ["security.protocol=SASL_PLAINTEXT", "sasl.mechanism=GSSAPI", "sasl.kerberos.service.name=kafka"]],
    ["src/cache.ts", ["const redis = new Redis(\"rediss://:s3cret@cache.prod.acme.io:6379/0\");", "const local = new Redis(\"redis://cache.prod.acme.io:6379\");"]],
    ["src/kafka.ts", ["const kafka = new Kafka({", "  ssl: true,", "  sasl: { mechanism: 'plain', username, password },", "});"]],
    // Local hosts, Compose services, and placeholders.
    ["settings.py", ["CELERY_BROKER_URL = 'amqp://guest:guest@localhost:5672//'", "REDIS_URL = 'redis://:pass@redis:6379/0'", "BROKER = 'amqp://user:pass@${RABBITMQ_HOST}:5672'"]],
    ["config/server.properties", ["advertised.listeners=SASL_PLAINTEXT://localhost:9092,SASL_PLAINTEXT://kafka-1:19092", "listeners=SASL_PLAINTEXT://:9093"]],
    // Kafka's default map, which names every protocol after itself.
    ["config/server.properties", ["listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,SSL:SSL,SASL_PLAINTEXT:SASL_PLAINTEXT,SASL_SSL:SASL_SSL"]],
    // Examples in Python docstrings.
    ["plugins/modules/rabbitmq_publish.py", ["EXAMPLES = r\"\"\"", "    url: \"amqp://guest:guest@192.168.0.32:5672/%2F\"", "\"\"\""]],
    ["src/mqtt.js", ["const client = mqtt.connect('mqtt://localhost', {", "  password: 'x',", "});"]],
    // Descriptions, development setups, and documentation.
    ["src/config.py", ["    help='Use SASL_PLAINTEXT or SASL_SSL for security_protocol=SASL_PLAINTEXT'"]],
    ["docker-compose.dev.yml", ["      KAFKA_SECURITY_PROTOCOL: SASL_PLAINTEXT"]],
    ["examples/consumer.py", ["    security_protocol=\"SASL_PLAINTEXT\","]],
    ["docs/kafka.md", ["security.protocol=SASL_PLAINTEXT"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testBrokerPlaintextAuthSkipsTestsAndCanBeDisabled(): void {
  const lines = ["security.protocol=SASL_PLAINTEXT"];
  assert.deepEqual(findings([added("src/test/resources/client.properties", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { brokerPlaintextAuth: { enabled: false } } });
  assert.deepEqual(findings([added("config/client.properties", lines)], config), []);
}
