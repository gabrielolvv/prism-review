import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const infrastructureFile = /\.(?:tf|tf\.json|hcl|json|ya?ml)$/i;

const settings: Array<[string, RegExp]> = [
  [
    "makes a storage bucket public",
    /\bacl\s*[=:]\s*["']public-read(?:-write)?["']|\bAccessControl["']?\s*:\s*["']?PublicRead(?:Write)?\b|\b(?:block_public_acls|block_public_policy|ignore_public_acls|restrict_public_buckets)\s*=\s*false\b|\b(?:BlockPublicAcls|BlockPublicPolicy|IgnorePublicAcls|RestrictPublicBuckets)["']?\s*:\s*["']?false\b|\b(?:allow_blob_public_access|allow_nested_items_to_be_public)\s*=\s*true\b/
  ],
  ["makes a database publicly accessible", /\bpublicly_accessible\s*=\s*true\b|\bPubliclyAccessible["']?\s*:\s*["']?true\b/],
  ["grants access to allUsers", /["'](?:allUsers|allAuthenticatedUsers)["']/]
];

// The whole internet as a source: IPv4 and IPv6 default routes and Azure's service tags.
const worldSource =
  /(?:^|[^\d.])0\.0\.0\.0\/0\b|(?:^|[^:\w])::\/0\b|\bsource_address_prefix\s*=\s*"(?:\*|Internet|Any)"|\bSourceAddressPrefix["']?\s*:\s*["']?(?:\*|Internet)\b/i;
const outbound = /egress|outbound/i;
// Outbound rules and rules that block traffic expose nothing.
const notInbound =
  /\b(?:type|direction)["']?\s*[=:]\s*["']?(?:egress|outbound)|\begress\s*=\s*true\b|\b(?:rule_action|access|Access|RuleAction)["']?\s*[=:]\s*["']?deny\b/i;
// Remote shells and desktops, databases, caches, search, container and cluster APIs.
const sensitivePorts = [22, 23, 2375, 2376, 2379, 2380, 3306, 3389, 5432, 5601, 5900, 5984, 6379, 9042, 9200, 9300, 10250, 11211, 1433, 1521, 27017];

type Block = { header: string; lines: string[] };

export const publicExposureRule: Rule = {
  id: "public-exposure",
  description: "Flags infrastructure that opens sensitive ports to the internet or makes storage and databases public.",
  run({ files, config }) {
    if (!config.rules.publicExposure.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !infrastructureFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findExposure(file.patch, /\.ya?ml$/i.test(file.path));
      if (found.length === 0) {
        return [];
      }

      const ports = [...new Set(found.flatMap((match) => match.ports ?? []))].sort((left, right) => left - right);
      const labels = [
        ...settings.map(([label]) => label).filter((label) => found.some((match) => match.label === label)),
        ...(ports.length > 0 ? [`opens ${ports.length > 1 ? "ports" : "port"} ${ports.join(", ")} to the internet`] : []),
        ...(found.some((match) => match.allPorts) ? ["opens every port to the internet"] : [])
      ];
      const lines = found.map((match) => match.line);
      const { text, plural } = describeLines(lines);

      return [
        {
          ruleId: "public-exposure",
          title: "Resource exposed to the internet",
          severity: "high" as const,
          file: file.path,
          line: Math.min(...lines),
          message: `${text} ${plural ? "expose" : "exposes"} resources to the internet: ${joinLabels(labels)}.`,
          recommendation:
            "Limit the source to known address ranges or reach the service through a VPN, bastion, or private endpoint. Keep buckets and databases private, and serve public files through a CDN with read-only access."
        }
      ];
    });
  }
};

type Exposure = { line: number; label?: string; ports?: number[]; allPorts?: boolean };

function findExposure(patch: string, yaml: boolean): Exposure[] {
  const found: Exposure[] = [];
  const pending: Array<{ line: number; chain: Block[] }> = [];
  let stack: Array<Block & { indent: number }> = [];

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      stack = [];
    }
    if (/^\s*(?:#|\/\/)/.test(content) || content.trim() === "") {
      continue;
    }
    // The blocks this line is in, including any it opens and closes, as one-line JSON does.
    let touched: Block[];

    if (yaml) {
      // A list item or a key that opens a mapping is a block; deeper lines belong to it.
      const indent = /^\s*/.exec(content)?.[0].length ?? 0;
      stack = stack.filter((block) => block.indent < indent);
      for (const block of stack) {
        block.lines.push(content);
      }
      if (/^\s*-\s/.test(content) || /:\s*$/.test(content)) {
        stack.push({ header: content, indent, lines: [content] });
      }
      touched = [...stack];
    } else {
      for (const block of stack) {
        block.lines.push(content);
      }
      touched = [...stack];
      // Braces open and close HCL and JSON blocks; the line that opens one is its header.
      for (const brace of content.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/[{}]/g) ?? []) {
        if (brace === "{") {
          const block = { header: content, indent: 0, lines: [content] };
          stack.push(block);
          touched.push(block);
        } else {
          stack.pop();
        }
      }
    }

    if (!added) {
      continue;
    }
    for (const [label, pattern] of settings) {
      if (pattern.test(content)) {
        found.push({ line, label });
      }
    }
    if (worldSource.test(content)) {
      pending.push({ line, chain: touched.reverse() });
    }
  }

  // Blocks hold every line of their children by now, so the innermost block with a port decides.
  for (const { line, chain } of pending) {
    if (chain.some((block) => outbound.test(block.header) || notInbound.test(block.lines.join("\n")))) {
      continue;
    }
    const block = chain.find((candidate) => portsIn(candidate.lines) !== undefined);
    const ports = block === undefined ? undefined : portsIn(block.lines);
    if (ports === "all") {
      found.push({ line, allPorts: true });
    } else if (ports !== undefined) {
      const open = sensitivePorts.filter((port) => ports.some(([from, to]) => port >= from && port <= to));
      if (open.length > 0) {
        found.push({ line, ports: open });
      }
    }
  }

  return found.sort((left, right) => left.line - right.line);
}

// The port ranges a block opens, "all" for every port, or undefined when it names none.
function portsIn(lines: string[]): Array<[number, number]> | "all" | undefined {
  const text = lines.join("\n");
  if (/\b(?:protocol|IpProtocol)["']?\s*[=:]\s*["']?(?:-1|all)\b/i.test(text)) {
    return "all";
  }
  const ranges: Array<[number, number]> = [];
  const froms = [...text.matchAll(/\b(?:from_port|FromPort)["']?\s*[=:]\s*"?(\d+)/g)].map((match) => Number(match[1]));
  const tos = [...text.matchAll(/\b(?:to_port|ToPort)["']?\s*[=:]\s*"?(\d+)/g)].map((match) => Number(match[1]));
  froms.forEach((from, index) => ranges.push([from, tos[index] ?? from]));

  const values = [
    ...[...text.matchAll(/\b(?:port|Port|destination_port_range|DestinationPortRange)["']?\s*[=:]\s*["']?(\*|\d+(?:-\d+)?)/g)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(/\b(?:ports|destination_port_ranges|DestinationPortRanges)["']?\s*[=:]\s*\[([^\]]*)\]/g)].flatMap((match) =>
      (match[1] ?? "").split(",").map((value) => value.replace(/["'\s]/g, ""))
    )
  ].filter(Boolean);
  for (const value of values) {
    if (value === "*") {
      return "all";
    }
    const [from, to] = value.split("-").map(Number);
    if (from !== undefined && !Number.isNaN(from)) {
      ranges.push([from, to ?? from]);
    }
  }

  return ranges.length > 0 ? ranges : undefined;
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}
