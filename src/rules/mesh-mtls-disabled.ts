import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "disabled" | "permissive";

const labels: Record<Kind, string> = {
  disabled: "turns mutual TLS off",
  permissive: "accepts plaintext next to mutual TLS"
};

// Istio's PeerAuthentication `mtls: { mode: DISABLE | PERMISSIVE }`, with port-level modes, and
// DestinationRule's `tls: { mode: DISABLE }` for a service in the cluster.
const modeLine = /^\s*-?\s*["']?mode["']?\s*:\s*["']?(DISABLE|PERMISSIVE)\b/;
const peerAuthentication = /^\s*kind\s*:\s*["']?PeerAuthentication\b/m;
const destinationRule = /^\s*kind\s*:\s*["']?DestinationRule\b/m;
const mtlsKey = /^\s*(?:mtls|portLevelMtls)\s*:|^\s*["']?\d{1,5}["']?\s*:\s*$/;
const tlsKey = /^\s*tls\s*:\s*$/;
// Hosts in the cluster: short names, `*.svc`, and `*.cluster.local`. DestinationRules for external
// hosts turn TLS off for services that only speak plaintext.
const hostLine = /^\s*host\s*:\s*["']?([\w.*-]+)["']?/;
// A `name.namespace` host is in the cluster unless its second part is a public top-level domain.
const clusterHost = /^[\w*-]+(?:\.(?!(?:com|org|net|io|dev|co|ai|app|cloud|us|uk|de|eu|info|biz|me|tech|xyz)$)[\w-]+)?$|\.svc(?:\.cluster\.local)?$|\.cluster\.local$/;
const keyWindow = 3;
// Istio's mesh-wide switch for automatic mutual TLS, under `meshConfig:` or the `mesh:` ConfigMap key.
// Other projects have their own `enableAutoMtls` option for their Istio integration.
const autoMtlsOff = /^\s*["']?enableAutoMtls["']?\s*:\s*["']?false\b/;
// Consul's service and mesh defaults: `MutualTLSMode = "permissive"` and the switch that allows it.
// As a key at the start of the line, so a CRD's description that names the setting is not one.
const consulPermissive = /^\s*["']?(?:MutualTLSMode|mutual_tls_mode|mutualTLSMode)["']?\s*[:=]\s*["']?permissive["']?\s*,?\s*(?:#.*)?$|^\s*["']?(?:AllowEnablingPermissiveMutualTLS|allow_enabling_permissive_mutual_tls|allowEnablingPermissiveMutualTLS)["']?\s*[:=]\s*true\s*,?\s*(?:#.*)?$/;
// Kuma's mesh-wide mTLS backends in permissive mode.
const kumaMesh = /^\s*kind\s*:\s*["']?Mesh\b/m;

const settingsFile = /\.(?:ya?ml|tpl|j2|json|hcl|tf)$/i;
const commentLine = /^\s*(?:#|\/\/|\{\{-?\s*\/\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const meshMtlsDisabledRule: Rule = {
  id: "mesh-mtls-disabled",
  description: "Flags service meshes set to turn mutual TLS off or to accept plaintext next to it.",
  run({ files, config }) {
    if (!config.rules.meshMtlsDisabled.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !settingsFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test clusters.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const peer = peerAuthentication.test(text);
      const destination = destinationRule.test(text);
      const kuma = kumaMesh.test(text);
      const found: Array<{ line: number; kind: Kind }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (autoMtlsOff.test(content) && parentKeys(lines, index).some((key) => key === "meshConfig" || key === "mesh")) {
          found.push({ line, kind: "disabled" });
          return;
        }
        if (consulPermissive.test(content)) {
          found.push({ line, kind: "permissive" });
          return;
        }
        const mode = modeLine.exec(content)?.[1];
        if (mode === undefined) {
          return;
        }
        const before = lines.slice(Math.max(0, index - keyWindow), index).map(({ content: other }) => other);
        const kind: Kind = mode === "DISABLE" ? "disabled" : "permissive";
        if ((peer || kuma) && before.some((other) => mtlsKey.test(other) || (kuma && /^\s*-?\s*(?:type|name)\s*:/.test(other)))) {
          found.push({ line, kind });
        } else if (destination && kind === "disabled" && before.some((other) => tlsKey.test(other)) && inClusterHost(lines, index)) {
          found.push({ line, kind });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      return [
        {
          ruleId: "mesh-mtls-disabled",
          title: "Service mesh mutual TLS weakened",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "set" : "sets"} the service mesh so that it ${listOf(kinds.map((kind) => labels[kind]))}, so traffic between services can be read or changed on the network, and any pod, including one an attacker controls, can call these services without a mesh identity that authorization policies check.`,
          recommendation:
            "Keep mutual TLS in `STRICT` mode, mesh-wide and for each workload, and leave automatic mutual TLS on. Use `PERMISSIVE` only while moving a workload into the mesh, and for a port that clients outside the mesh call, such as a webhook, serve TLS on that port and limit `PERMISSIVE` to it with `portLevelMtls`."
        }
      ];
    });
  }
};

// Whether the DestinationRule the line is in names a host in the cluster.
function inClusterHost(lines: Array<{ content: string }>, index: number): boolean {
  for (let before = index - 1; before >= Math.max(0, index - 40); before -= 1) {
    const content = lines[before]?.content ?? "";
    const host = hostLine.exec(content)?.[1];
    if (host !== undefined) {
      return clusterHost.test(host);
    }
    if (/^---\s*$/.test(content)) {
      break;
    }
  }
  return false;
}

// The YAML keys the line sits under, found by walking up to the lines with less indentation.
function parentKeys(lines: Array<{ content: string }>, index: number): string[] {
  const keys: string[] = [];
  let indent = /^\s*/.exec(lines[index]?.content ?? "")?.[0].length ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - 200) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    const own = /^\s*/.exec(content)?.[0].length ?? 0;
    if (content.trim() !== "" && own < indent) {
      const key = /^\s*-?\s*["']?([\w.-]+)["']?\s*:/.exec(content)?.[1];
      if (key !== undefined) {
        keys.push(key);
      }
      indent = own;
    }
  }
  return keys;
}
