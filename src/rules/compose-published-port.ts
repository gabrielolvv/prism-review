import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";
import { sensitivePorts } from "./public-exposure.js";
import { servicePorts } from "./public-load-balancer.js";

type Published = { line: number; port: number };

const composeFile = /\.ya?ml$/i;
// Compose files for servers, by the same path words `deployment-env-secret` reads: production, stack,
// deploy, release, live, and Swarm. Development overrides are left out.
const productionPath = /(?:^|[\/_.-])(?:prod|production|stack|deploy|deployment|release|live|swarm)(?:[\/_.-]|$)/i;
const overrideFile = /(?:^|\/)(?:docker-)?compose\.override\.ya?ml$|(?:^|[\/_.-])(?:dev|development|local|sandbox|test|ci|e2e)(?:[\/_.-]|$)/i;
const servicesKey = /^services\s*:\s*(?:#.*)?$/m;
const portsKey = /^(\s*)ports\s*:\s*(?:#.*)?$/;
const exposedPorts = new Set([...sensitivePorts, ...Object.keys(servicePorts).map(Number)]);

const loopback = /^(?:127\.\d+\.\d+\.\d+|localhost|::1|\[::1\])$/i;
const privateAddress = /^(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|f[cd][0-9a-f]{2}:.*)$/i;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

function unquote(value: string): string {
  return value.trim().replace(/\s+#.*$/, "").replace(/^(["'])(.*)\1$/, "$2");
}

// Whether a host address publishes on every interface: empty, `0.0.0.0`, or `::`. Variables, such as
// `${BIND_IP}`, are left to the deployment.
function everyInterface(address: string): boolean {
  if (address === "" || address === "0.0.0.0" || address === "::" || address === "[::]") {
    return true;
  }
  return !loopback.test(address) && !privateAddress.test(address) && !/\$/.test(address) && /^[\d.]+$/.test(address);
}

// The container ports of a short-syntax entry, such as `5432`, `5432:5432`, `0.0.0.0:6379:6379`,
// `[::1]:5432:5432`, or `9200-9300:9200-9300/tcp`, when it publishes on every interface.
function shortSyntax(entry: string): number[] {
  // Variables such as `${DB_PORT:-5432}` hold colons of their own.
  const spec = entry.replace(/\$\{[^}]*\}/g, "$VAR").replace(/\/(?:tcp|udp|sctp)$/i, "");
  let address = "";
  let rest = spec;
  const bracketed = /^\[([^\]]*)\]:(.*)$/.exec(spec);
  if (bracketed !== null) {
    address = bracketed[1] ?? "";
    rest = bracketed[2] ?? "";
  } else {
    const parts = spec.split(":");
    if (parts.length >= 3) {
      address = parts.slice(0, -2).join(":");
      rest = parts.slice(-2).join(":");
    }
  }
  if (!everyInterface(address)) {
    return [];
  }
  const container = rest.split(":").at(-1) ?? "";
  const range = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(container);
  if (range === null) {
    return [];
  }
  const first = Number(range[1]);
  const last = Number(range[2] ?? range[1]);
  return [...exposedPorts].filter((port) => port >= first && port <= last && last - first < 2000);
}

function publishedPorts(lines: PatchLine[]): Published[] {
  const found: Published[] = [];
  lines.forEach(({ content }, index) => {
    const ports = portsKey.exec(content);
    if (ports === null) {
      return;
    }
    const keyIndent = (ports[1] ?? "").length;
    for (let position = index + 1; position < lines.length; position += 1) {
      const item = lines[position];
      if (item === undefined || item.startsHunk) {
        break;
      }
      if (item.content.trim() === "" || /^\s*#/.test(item.content)) {
        continue;
      }
      const itemIndent = indentOf(item.content);
      if (itemIndent < keyIndent || (itemIndent === keyIndent && !/^\s*-/.test(item.content))) {
        break;
      }
      const short = /^\s*-\s+(?!target\s*:|published\s*:|host_ip\s*:|mode\s*:|protocol\s*:|name\s*:|app_protocol\s*:)(.+)$/.exec(item.content);
      if (short !== null) {
        if (item.added) {
          found.push(...shortSyntax(unquote(short[1] ?? "")).map((port) => ({ line: item.line, port })));
        }
        continue;
      }
      // Long syntax: `- target: 5432` with `published`, `host_ip`, and `mode` beside it.
      const start = /^(\s*)-\s+\w+\s*:/.exec(item.content);
      if (start === null) {
        continue;
      }
      const dash = (start[1] ?? "").length;
      const entry: PatchLine[] = [item];
      while (position + 1 < lines.length) {
        const next = lines[position + 1];
        if (next === undefined || next.startsHunk || (next.content.trim() !== "" && indentOf(next.content) <= dash)) {
          break;
        }
        entry.push(next);
        position += 1;
      }
      const field = (name: string) => entry.map(({ content: text }) => new RegExp(`^\\s*-?\\s*${name}\\s*:\\s*(.+)$`).exec(text)?.[1]).find((value) => value !== undefined);
      const target = Number(unquote(field("target") ?? ""));
      if (exposedPorts.has(target) && everyInterface(unquote(field("host_ip") ?? "")) && entry.some(({ added }) => added)) {
        found.push({ line: item.line, port: target });
      }
    }
  });
  return found;
}

export const composePublishedPortRule: Rule = {
  id: "compose-published-port",
  description:
    "Warns about production Docker Compose and Swarm stack files that publish a database, cache, broker, or shell port on every interface of the host, where Docker opens it past host firewalls such as ufw.",
  run({ files, config }) {
    if (!config.rules.composePublishedPort.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !composeFile.test(file.path) ||
        file.patch === undefined ||
        !productionPath.test(file.path) ||
        overrideFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }
      const lines = patchLines(file.patch);
      // Compose files have a top-level `services:` key; Kubernetes manifests have `ports:` too.
      const text = lines.map(({ content }) => content).join("\n");
      if (!servicesKey.test(text) && !/compose|stack/i.test(file.path)) {
        return [];
      }
      if (/^kind\s*:/m.test(text)) {
        return [];
      }

      const found = publishedPorts(lines);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text: where, plural } = describeLines(lineNumbers);
      const ports = [...new Set(found.map(({ port }) => port))].sort((left, right) => left - right);
      const named = ports.map((port) => (servicePorts[port] === undefined ? `${port}` : `${port} (${servicePorts[port]})`));
      return [
        {
          ruleId: "compose-published-port",
          title: "Database or admin port published on every interface",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "publish" : "publishes"} ${ports.length > 1 ? "ports" : "port"} ${listOf(named)} on every network interface of the host. Docker opens published ports past host firewalls such as ufw and firewalld, so unless something in front of the host blocks ${ports.length > 1 ? "them" : "it"}, anyone on the internet can connect.`,
          recommendation:
            "Drop `ports` from services that only other containers use: they reach each other by service name on the Compose network. If the host itself needs the port, bind it to the loopback or a private address, such as `127.0.0.1:5432:5432`, and connect through an SSH tunnel or a VPN."
        }
      ];
    });
  }
};
