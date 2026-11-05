import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Broker = "Kafka" | "RabbitMQ" | "Redis" | "MQTT" | "NATS";

// Kafka clients that log in with SASL over plaintext: properties, YAML, environment variables,
// Java's `props.put("security.protocol", "SASL_PLAINTEXT")`, and librdkafka's lower case.
const kafkaClient = /(?:\b|_)security[._-]?protocol(?:_config)?["']?\s*[:=,]\s*["']?(?:SecurityProtocol\.)?SASL_PLAINTEXT\b/i;
// Kubernetes' `- name: KAFKA_SECURITY_PROTOCOL` with `value: SASL_PLAINTEXT` on the next line.
const kafkaEnvValue = /^\s*value\s*:\s*["']?SASL_PLAINTEXT\b/i;
const kafkaEnvName = /^\s*-?\s*name\s*:\s*["']?\w*SECURITY_PROTOCOL["']?\s*$/i;
// Kafka brokers that tell clients to log in with SASL on a plaintext listener, by the address they
// advertise. The address a listener binds to, often empty in a container, says nothing about who connects.
const kafkaListener = /\bSASL_PLAINTEXT:\/\/([^:,\s"']*):\d+/gi;
const kafkaListenerKey = /advertised[._]listeners/i;
// A listener name mapped to SASL_PLAINTEXT. Kafka's default map lists `SASL_PLAINTEXT:SASL_PLAINTEXT`
// among the protocols' own names, which no listener uses until one is named so.
const kafkaProtocolMap = /\b(?:listener\.security\.protocol\.map|LISTENER_SECURITY_PROTOCOL_MAP)["']?\s*[:=]/i;
const kafkaMapEntry = /\b(\w+):SASL_PLAINTEXT\b/gi;
// Kerberos never sends the password, so files that only use GSSAPI are left out.
const gssapi = /\bGSSAPI\b/;
const passwordMechanism = /\b(?:PLAIN|SCRAM-SHA-(?:256|512)|OAUTHBEARER)\b|\bsasl\.jaas\.config\b|PlainLoginModule|ScramLoginModule/;
// KafkaJS's `sasl: { ... }` next to `ssl: false`.
const kafkajsSsl = /^\s*ssl\s*:\s*false\b/;
const kafkajsSasl = /^\s*sasl\s*:/;
const kafkajsWindow = 6;
// Connection URLs with a password and no TLS: amqp, redis, mqtt, and nats instead of amqps, rediss,
// mqtts, and tls.
const passwordUrl = /\b(amqp|redis|mqtt|nats):\/\/[^/@\s"'`:]*:[^@/\s"'`]+@([^/:?\s"'`,)]+)/gi;
// mqtt.js's `mqtt.connect("mqtt://host", { username, password })`.
const mqttConnect = /\bconnect(?:Async)?\s*\(\s*["'`]mqtt:\/\/([^/:"'`]+)/;
const mqttPassword = /\bpassword\s*:/;
const mqttWindow = 6;

const urlBrokers: Record<string, Broker> = { amqp: "RabbitMQ", redis: "Redis", mqtt: "MQTT", nats: "NATS" };

// A host on the same machine or a private container network, such as Compose's `kafka` service, or a
// name that is filled in later.
const localHost = /^(?:localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|host\.docker\.internal|[^.]+|.*\.local|.*\.localhost|.*\.internal|.*\.svc(?:\.cluster\.local)?)$/i;
const placeholderHost = /[{}$<>%[\]]|\bexample\.(?:com|org|net)\b|^(?:host|hostname|broker|server)(?:\.(?:domain|example)\b.*)?$|\b(?:your|my)[-_]?(?:host|server|broker)\b/i;

const sourceFile =
  /\.(?:[cm]?[jt]sx?|py|java|kt|scala|go|cs|rb|php|properties|ya?ml|json|toml|env|conf|cfg|ini|sh|bash|tf)$|(?:^|\/)(?:Dockerfile[^/]*|Containerfile|\.env(?:\.[\w-]+)?)$/i;
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e|integtest)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\/|(?:^|\/)(?:molecule|\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer)(?:\/|$)|(?:^|\/)(?:docker-)?compose\.override\.ya?ml$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|\.lock$|(?:^|\/)package-lock\.json$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--|--)/;
const describesValues = /\b(?:description|help|usage|doc)\s*[:=]|\b(?:or|either)\s+SASL_SSL\b/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const brokerPlaintextAuthRule: Rule = {
  id: "broker-plaintext-auth",
  description: "Flags message brokers and caches that log in over connections without TLS, such as Kafka's SASL_PLAINTEXT and amqp:// or redis:// URLs with a password.",
  run({ files, config }) {
    if (!config.rules.brokerPlaintextAuth.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test setups run on a developer's machine.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const kerberosOnly = gssapi.test(text) && !passwordMechanism.test(text);
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; broker: Broker }> = [];
      // Python docstrings hold examples, as Ansible modules' EXAMPLES do.
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|\'\'\'/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (wasInDocstring || !added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        const brokers: Broker[] = [];
        const envPair = kafkaEnvValue.test(content) && kafkaEnvName.test(lines[index - 1]?.content ?? "");
        const customListener = kafkaProtocolMap.test(content) && [...content.matchAll(kafkaMapEntry)].some((match) => (match[1] ?? "").toUpperCase() !== "SASL_PLAINTEXT");
        if (!kerberosOnly && (kafkaClient.test(content) || customListener || envPair)) {
          brokers.push("Kafka");
        }
        if (!kerberosOnly && kafkaListenerKey.test(content)) {
          for (const match of content.matchAll(kafkaListener)) {
            const host = match[1] ?? "";
            if (host !== "" && !isLocal(host)) {
              brokers.push("Kafka");
            }
          }
        }
        if (kafkajsSsl.test(content) && lines.slice(Math.max(0, index - kafkajsWindow), index + kafkajsWindow).some(({ content: other }) => kafkajsSasl.test(other))) {
          brokers.push("Kafka");
        }
        for (const match of content.matchAll(passwordUrl)) {
          if (!isLocal(match[2] ?? "")) {
            brokers.push(urlBrokers[(match[1] ?? "").toLowerCase()] ?? "Redis");
          }
        }
        const mqtt = mqttConnect.exec(content);
        if (mqtt !== null && !isLocal(mqtt[1] ?? "") && lines.slice(index, index + mqttWindow).some(({ content: other }) => mqttPassword.test(other))) {
          brokers.push("MQTT");
        }
        if (brokers.length > 0) {
          found.push({ line, broker: brokers[0] as Broker });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const brokers = [...new Set(found.map(({ broker }) => broker))];
      return [
        {
          ruleId: "broker-plaintext-auth",
          title: "Broker login without TLS",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "log" : "logs"} in to ${listOf(brokers)} over a connection without TLS, so anyone on the network path can read the password or token and use it to read, publish, or delete messages and data.`,
          recommendation:
            "Use the TLS form of the connection: Kafka's `SASL_SSL`, `amqps://`, `rediss://`, `mqtts://`, and `tls://` for NATS, with the server's certificate checked. Keep plaintext listeners on localhost, or use Kerberos (GSSAPI), which never sends the password."
        }
      ];
    });
  }
};

function isLocal(host: string): boolean {
  return localHost.test(host) || placeholderHost.test(host);
}
