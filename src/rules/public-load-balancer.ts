import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";
import { sensitivePorts } from "./public-exposure.js";

type Exposure = { line: number; ports: number[] };

const manifestFile = /\.(?:ya?ml|json|tf|tf\.json)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ\w*|kind|minikube|k3d)(?:[\/_.-]|$)|__snapshots__|\.snap$|(?:^|\/)(?:hack|docs?)\//i;

// The ports `public-exposure` reports, and brokers, consoles, and stores that Kubernetes often runs.
export const servicePorts: Record<number, string> = {
  22: "SSH",
  23: "Telnet",
  1433: "SQL Server",
  1521: "Oracle",
  2181: "ZooKeeper",
  2375: "Docker",
  2376: "Docker",
  2379: "etcd",
  2380: "etcd",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5601: "Kibana",
  5672: "AMQP",
  5900: "VNC",
  5984: "CouchDB",
  6379: "Redis",
  8086: "InfluxDB",
  8123: "ClickHouse",
  8500: "Consul",
  9042: "Cassandra",
  9092: "Kafka",
  9200: "Elasticsearch",
  9300: "Elasticsearch",
  10250: "the kubelet",
  11211: "Memcached",
  15672: "RabbitMQ's console",
  27017: "MongoDB"
};
const exposedPorts = new Set([...sensitivePorts, ...Object.keys(servicePorts).map(Number)]);

const loadBalancerType = /^(\s*)["']?type["']?\s*:\s*["']?LoadBalancer["']?\s*,?\s*(?:#.*)?$/;
const terraformType = /^\s*type\s*=\s*"LoadBalancer"/;
// Ports in a Service, Helm values, or Terraform: `port: 5432`, `targetPort: 6379`, `- port: 9200`,
// `"port": 27017`, `port = 3306`, and named ports in a `ports:` map, such as `redis: 6379`.
const portKey = /(?:^|[\s{,-])["']?(?:port|targetPort|target_port|servicePort|containerPort)["']?\s*[:=]\s*["']?(\d{2,5})(?![\d.])/;
const namedPort = /^\s*["']?[\w-]+["']?\s*:\s*["']?(\d{2,5})["']?\s*(?:#.*)?$/;
const portsKey = /^\s*["']?ports["']?\s*:\s*(?:#.*)?$/;
// Load balancers kept off the internet: internal annotations of AWS, Google Cloud, Azure, OpenStack,
// IBM, Oracle, and Alibaba Cloud, and source ranges that are not the whole internet.
const internal =
  /aws-load-balancer-internal["']?\s*[:=]\s*["']?(?:true|0\.0\.0\.0\/0)|aws-load-balancer-scheme["']?\s*[:=]\s*["']?internal\b|load-balancer-type["']?\s*[:=]\s*["']?internal\b|azure-load-balancer-internal["']?\s*[:=]\s*["']?true|openstack-internal-load-balancer["']?\s*[:=]\s*["']?true|ip-type["']?\s*[:=]\s*["']?private\b|oci-load-balancer-internal["']?\s*[:=]\s*["']?true|address-type["']?\s*[:=]\s*["']?intranet\b/i;
const sourceRanges = /loadBalancerSourceRanges|load_balancer_source_ranges/;
const worldRange = /0\.0\.0\.0\/0|::\/0/;
const privateRange = /\b(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|\d+\.\d+\.\d+\.\d+\/(?:[89]|[12]\d|3[0-2]))\b/;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

// A YAML document's lines, split at `---`; a new hunk may start in another document.
function documents(lines: PatchLine[]): PatchLine[][] {
  const found: PatchLine[][] = [[]];
  for (const line of lines) {
    if (/^---\s*(?:#.*)?$/.test(line.content) || (line.startsHunk && (found.at(-1)?.length ?? 0) > 0)) {
      found.push([]);
    }
    if (!/^---/.test(line.content)) {
      found.at(-1)?.push(line);
    }
  }
  return found;
}

// Whether the document keeps the load balancer off the internet.
function keptPrivate(document: PatchLine[]): boolean {
  const text = document.map(({ content }) => content).join("\n");
  if (internal.test(text)) {
    return true;
  }
  if (!sourceRanges.test(text)) {
    return false;
  }
  // Source ranges limit who can connect unless they include the whole internet.
  const start = document.findIndex(({ content }) => sourceRanges.test(content));
  const ranges = document.slice(start, start + 12).map(({ content }) => content).join("\n");
  return !worldRange.test(ranges) && privateRange.test(ranges);
}

// The mapping that holds the `type: LoadBalancer` line at `index`: its siblings and their children.
function mappingAround(document: PatchLine[], index: number, indent: number): PatchLine[] {
  let first = index;
  while (first > 0) {
    const previous = document[first - 1]?.content ?? "";
    if (previous.trim() !== "" && (indentOf(previous) < indent || /^\s*-\s/.test(previous) && indentOf(previous) + 2 <= indent)) {
      break;
    }
    first -= 1;
  }
  let last = index;
  while (last + 1 < document.length) {
    const next = document[last + 1]?.content ?? "";
    if (next.trim() !== "" && indentOf(next) < indent) {
      break;
    }
    last += 1;
  }
  return document.slice(first, last + 1);
}

// Whether a mapping that holds the Service, up to three levels out, is turned off with
// `enabled: false`, as Helm charts do for optional external access.
function turnedOff(document: PatchLine[], index: number, indent: number): boolean {
  let position = index;
  let level = indent;
  for (let depth = 0; depth < 3 && level > 0; depth += 1) {
    const mapping = mappingAround(document, position, level);
    if (mapping.some(({ content }) => indentOf(content) === level && /^\s*["']?enabled["']?\s*:\s*false\b/.test(content))) {
      return true;
    }
    const start = document.indexOf(mapping[0] as PatchLine);
    const parent = start - 1;
    const parentLine = document[parent]?.content ?? "";
    if (parent < 0 || parentLine.trim() === "") {
      return false;
    }
    position = parent;
    level = indentOf(parentLine);
  }
  return false;
}

// The sensitive ports in a mapping, with their lines.
function portsIn(mapping: PatchLine[]): Array<{ port: number; line: PatchLine }> {
  const found: Array<{ port: number; line: PatchLine }> = [];
  let portsIndent: number | undefined;
  for (const line of mapping) {
    const { content } = line;
    if (content.trim() === "" || /^\s*#/.test(content)) {
      continue;
    }
    if (portsIndent !== undefined && indentOf(content) <= portsIndent) {
      portsIndent = undefined;
    }
    if (portsKey.test(content)) {
      portsIndent = indentOf(content);
      continue;
    }
    const match = portKey.exec(content) ?? (portsIndent !== undefined ? namedPort.exec(content) : null);
    const port = Number(match?.[1]);
    if (match !== null && exposedPorts.has(port)) {
      found.push({ port, line });
    }
  }
  return found;
}

function yamlExposures(lines: PatchLine[]): Exposure[] {
  return documents(lines).flatMap((document) => {
    if (keptPrivate(document)) {
      return [];
    }
    return document.flatMap((typeLine, index) => {
      const type = loadBalancerType.exec(typeLine.content);
      if (type === null) {
        return [];
      }
      const indent = (type[1] ?? "").length;
      const ports = portsIn(mappingAround(document, index, indent));
      if (ports.length === 0 || (!typeLine.added && !ports.some(({ line }) => line.added)) || turnedOff(document, index, indent)) {
        return [];
      }
      return [{ line: typeLine.line, ports: ports.map(({ port }) => port) }];
    });
  });
}

// Terraform's `kubernetes_service` resources with `type = "LoadBalancer"`.
function terraformExposures(lines: PatchLine[]): Exposure[] {
  const found: Exposure[] = [];
  lines.forEach((typeLine, index) => {
    if (!terraformType.test(typeLine.content)) {
      return;
    }
    let start = index;
    while (start > 0 && index - start < 40 && !/^\s*resource\s+"kubernetes_service(?:_v1)?"/.test(lines[start]?.content ?? "")) {
      start -= 1;
    }
    if (!/^\s*resource\s+"kubernetes_service(?:_v1)?"/.test(lines[start]?.content ?? "")) {
      return;
    }
    let end = start;
    let depth = 0;
    for (; end < lines.length && end < start + 120; end += 1) {
      const content = lines[end]?.content ?? "";
      depth += (content.match(/\{/g)?.length ?? 0) - (content.match(/\}/g)?.length ?? 0);
      if (end > start && depth <= 0) {
        break;
      }
    }
    const block = lines.slice(start, end + 1);
    if (keptPrivate(block)) {
      return;
    }
    const ports = portsIn(block);
    if (ports.length > 0 && (typeLine.added || ports.some(({ line }) => line.added))) {
      found.push({ line: typeLine.line, ports: ports.map(({ port }) => port) });
    }
  });
  return found;
}

export const publicLoadBalancerRule: Rule = {
  id: "public-load-balancer",
  description:
    "Flags Kubernetes Services of type `LoadBalancer` that put a database, cache, broker, or remote shell on a public load balancer, in manifests, Helm values, and Terraform, unless an internal annotation or source ranges keep it private.",
  run({ files, config }) {
    if (!config.rules.publicLoadBalancer.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !manifestFile.test(file.path) ||
        file.patch === undefined ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test clusters.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found = /\.tf(?:\.json)?$/i.test(file.path) ? terraformExposures(lines) : yamlExposures(lines);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lineNumbers);
      const ports = [...new Set(found.flatMap((exposure) => exposure.ports))].sort((left, right) => left - right);
      const named = ports.map((port) => (servicePorts[port] === undefined ? `${port}` : `${port} (${servicePorts[port]})`));
      return [
        {
          ruleId: "public-load-balancer",
          title: "Database or admin port on a public load balancer",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "expose" : "exposes"} ${ports.length > 1 ? "ports" : "port"} ${listOf(named)} through a public cloud load balancer, so anyone on the internet can connect to ${ports.length > 1 ? "them" : "it"} and try passwords, or read data if authentication is off.`,
          recommendation:
            "Keep databases, caches, brokers, and shells on a `ClusterIP` Service and reach them through the cluster, a VPN, or `kubectl port-forward`. If something outside the cluster needs the port, make the load balancer internal with your cloud's annotation, such as `service.beta.kubernetes.io/aws-load-balancer-internal: \"true\"` or `networking.gke.io/load-balancer-type: \"Internal\"`, or limit it with `loadBalancerSourceRanges`."
        }
      ];
    });
  }
};
