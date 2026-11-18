import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Component = "apiserver" | "etcd" | "kubelet";
type Setting = { label: string; high: boolean; component: Component; pattern: RegExp };
type Found = { line: number; label: string; high: boolean };

// Settings files, scripts, and templates that start control plane components: kubeadm, kops, k3s,
// RKE, Talos, and Kubespray settings, systemd units, static pod manifests, and bootstrap scripts.
const settingsFile = /\.(?:ya?ml|json|sh|bash|conf|service|env|toml|tf|tfvars|hcl|ini|cfg|j2|tmpl|tpl)$|(?:^|\/)(?:Dockerfile|Makefile)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ)(?:[\/_.-]|$)|__snapshots__|\.snap$|(?:^|\/)(?:hack|docs?)\/|(?:^|\/)[^/]*mock[^/]*\//i;
const commentLine = /^\s*(?:-\s*)?(?:#|\/\/|\/\*|\*|;)/;
// Benchmark checks, such as kube-bench's and the Trivy operator's CIS specs, which name these flags
// in order to look for them.
const checkDefinition = /^[+ ]\s*-?\s*(?:remediation|audit|test_items)\s*:/m;
// Lines that describe a setting rather than set it: descriptions, check names, and commands that
// search a running process's arguments.
const prose = /^\s*-?\s*["']?(?:text|description|remediation|audit|flag|name|title|summary|message|help|usage|reason|details?)["']?\s*:|\bgrep\b|\bps\s+-/i;

// A file is about a component when it or its path names it.
const components: Record<Component, RegExp> = {
  apiserver: /kube-apiserver|\bapiServer\b|\bkubeAPIServer\b|KubeAPIServer|ClusterConfiguration|\bapiserver/i,
  etcd: /etcd/i,
  kubelet: /kubelet/i
};

const port = String.raw`["']?\s*[=:]?\s*["']?[1-9]\d*\b`;
const settings: Setting[] = [
  {
    label: "serves the Kubernetes API on its insecure port, with no authentication or authorization",
    high: true,
    component: "apiserver",
    pattern: new RegExp(String.raw`(?:--|["'\s]|^)insecure-port${port}|\binsecurePort${port}`)
  },
  {
    label: "binds the API server's insecure port beyond localhost",
    high: true,
    component: "apiserver",
    pattern: /(?:--|["'\s]|^)insecure-bind-address["']?\s*[=:\s]\s*["']?(?!127\.)(?:\d{1,3}(?:\.\d{1,3}){3}|::|\[::\])(?![\d.])|\binsecureBindAddress["']?\s*:\s*["']?(?!127\.)(?:\d{1,3}(?:\.\d{1,3}){3}|::)(?![\d.])/
  },
  {
    label: "authenticates with a static token or password file, whose credentials never expire and cannot be revoked without restarting the API server",
    high: false,
    component: "apiserver",
    pattern: /(?:--|["'\s]|^)(?:token|basic)-auth-file["']?\s*[=:\s]\s*["']?[/$\w]|\b(?:tokenAuthFile|basicAuthFile)["']?\s*:\s*["']?[/$\w]/
  },
  {
    label: "turns admission control off with `AlwaysAdmit`",
    high: false,
    component: "apiserver",
    pattern: /(?:enable-admission-plugins|admission-control|enableAdmissionPlugins|admissionControl)["']?\s*[=:]\s*["'[]?[^\n]*\bAlwaysAdmit\b/
  },
  {
    label: "lets etcd accept clients or peers without a certificate",
    high: true,
    component: "etcd",
    pattern: /(?:--|["'\s]|^|ETCD_)(?:peer[-_])?client[-_]cert[-_]auth["']?\s*[=:]\s*["']?false\b/i
  },
  {
    label: "serves etcd over plain HTTP beyond localhost",
    high: true,
    component: "etcd",
    pattern: /(?:listen-client-urls|LISTEN_CLIENT_URLS|listen-peer-urls|LISTEN_PEER_URLS)["']?(?:\s*[=:]\s*|\s+)["']?[^"'\s]*http:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/
  },
  {
    label: "gives etcd self-signed certificates with `auto-tls`, which do not check who connects",
    high: false,
    component: "etcd",
    pattern: /(?:--|["'\s]|^|ETCD_)(?:peer[-_])?auto[-_]tls["']?\s*[=:]\s*["']?true\b/i
  },
  {
    label: "opens the kubelet's read-only port, which serves pod specs and their environment variables to anyone on the network without authentication",
    high: false,
    component: "kubelet",
    pattern: new RegExp(String.raw`(?:--|["'\s]|^)read-only-port${port}|\breadOnlyPort${port}`)
  }
];

// Kubelet configuration files: `anonymous:` with `enabled: true` below it, `mode: AlwaysAllow` under
// `authorization:`, and kops' `anonymousAuth: true` and `authorizationMode: AlwaysAllow`. The
// `--anonymous-auth` and `--authorization-mode` flags are reported by `service-auth-disabled`.
const anonymousEnabled = /^\s*["']?enabled["']?\s*:\s*true\b/;
const anonymousKey = /^\s*["']?anonymous["']?\s*:\s*(?:#.*)?$/;
const anonymousInline = /["']?anonymous["']?\s*:\s*\{\s*["']?enabled["']?\s*:\s*true\b/;
const anonymousAuth = /^\s*anonymousAuth\s*:\s*true\b/;
const alwaysAllow = /^\s*["']?mode["']?\s*:\s*["']?AlwaysAllow\b|^\s*authorizationMode\s*:\s*["']?AlwaysAllow\b|["']mode["']\s*:\s*["']AlwaysAllow["']/;
const authorizationKey = /^\s*["']?authorization["']?\s*:\s*(?:#.*)?$/;

function exposures(lines: PatchLine[], about: Set<Component>): Found[] {
  const found: Found[] = [];
  let previous = "";
  let beforePrevious = "";
  lines.forEach(({ line, content, added, startsHunk }) => {
    const [last, earlier] = startsHunk ? ["", ""] : [previous, beforePrevious];
    if (content.trim() !== "") {
      beforePrevious = previous;
      previous = content;
    }
    if (!added || commentLine.test(content) || prose.test(content)) {
      return;
    }
    for (const { label, high, component, pattern } of settings) {
      if (about.has(component) && pattern.test(content)) {
        found.push({ line, label, high });
      }
    }
    if (!about.has("kubelet") && !about.has("apiserver")) {
      return;
    }
    if (anonymousInline.test(content) || anonymousAuth.test(content) || (anonymousEnabled.test(content) && anonymousKey.test(last))) {
      found.push({ line, label: "lets anonymous requests through", high: false });
    }
    if (alwaysAllow.test(content) && (!/^\s*["']?mode["']?\s*:/.test(content) || authorizationKey.test(last) || authorizationKey.test(earlier))) {
      found.push({ line, label: "authorizes every request with `AlwaysAllow`", high: true });
    }
  });
  return found;
}

export const kubernetesControlPlaneRule: Rule = {
  id: "kubernetes-control-plane",
  description:
    "Flags Kubernetes control plane settings that let requests in without authentication: the API server's insecure port, static token files, and `AlwaysAdmit`, etcd without client certificates or over HTTP, and the kubelet's read-only port, anonymous access, and `AlwaysAllow` in its configuration file.",
  run({ files, config }) {
    if (!config.rules.kubernetesControlPlane.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !settingsFile.test(file.path) ||
        file.patch === undefined ||
        ciOrTestSetup.test(file.path) ||
        checkDefinition.test(file.patch) ||
        // Development, example, and test clusters.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const text = `${file.path}\n${file.patch}`;
      const about = new Set((Object.keys(components) as Component[]).filter((component) => components[component].test(text)));
      if (about.size === 0) {
        return [];
      }
      const found = exposures(patchLines(file.patch), about);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text: where } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "kubernetes-control-plane",
          title: "Kubernetes control plane left open",
          severity: found.some(({ high }) => high) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${where.charAt(0).toLowerCase()}${where.slice(1)}, the cluster ${listOf(labels)}. Whoever reaches these ports can read the cluster's Secrets and pod specs, or change workloads, without credentials.`,
          recommendation:
            "Keep the API server's insecure port at 0 and authenticate with client certificates, OIDC, or service account tokens instead of static token files. Run etcd with `client-cert-auth` and `peer-client-cert-auth` on certificates from your own CA, listening on HTTPS. Set the kubelet's `readOnlyPort` to 0, turn anonymous authentication off, and use `Webhook` authorization, as the CIS Kubernetes Benchmark recommends."
        }
      ];
    });
  }
};
