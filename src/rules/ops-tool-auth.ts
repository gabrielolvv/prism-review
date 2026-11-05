import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = {
  label: string;
  high?: boolean;
  pattern: RegExp;
  // Each must appear in one of the lines just before, such as the YAML keys the setting sits under.
  under?: RegExp[];
  // Must appear somewhere in the file's changed lines or path, for keys other tools also use.
  context?: RegExp;
};

// Assembled so this file does not match its own patterns.
const flag = (name: string): RegExp => new RegExp(String.raw`--${name}(?:=true)?(?![=\w-])`);

const settings: Setting[] = [
  // Jenkins with security off runs any script, as any user, from its web page.
  {
    label: "Jenkins with its security turned off",
    high: true,
    pattern: /<useSecurity>\s*false\s*<\/useSecurity>|AuthorizationStrategy\$Unsecured\b|^\s*authorizationStrategy\s*:\s*["']?unsecured\b/
  },
  // Flask-AppBuilder's role for visitors who have not logged in, in Airflow and Superset.
  { label: "Airflow or Superset with admin rights for visitors who have not logged in", high: true, pattern: /^\s*AUTH_ROLE_PUBLIC\s*=\s*["'](?:Admin|Op)["']/ },
  // Vault's development server keeps secrets in memory, unsealed, with a root token anyone can set.
  {
    label: "Vault's development server",
    high: true,
    pattern: /\bvault\s+server\b[^\n]*\s-dev\b|["']server["']\s*,\s*["']-dev["']|\bVAULT_DEV_ROOT_TOKEN_ID["']?\s*[:=]\s*["']?[^\s"'\\]/
  },
  { label: "Vault's development server", high: true, pattern: /^\s*enabled\s*:\s*["']?true\b/, under: [/^\s*dev\s*:\s*$/], context: /\bvault\b/i },
  // The Kubernetes Dashboard's login skip, which acts as the dashboard's own service account.
  { label: "the Kubernetes Dashboard without its login", pattern: new RegExp(`${flag("enable-skip-login").source}|${flag("enable-insecure-login").source}|^\\s*enable(?:Skip|Insecure)Login\\s*:\\s*true\\b`) },
  // Argo CD's anonymous access and its switch that turns login off.
  {
    label: "Argo CD without its login",
    pattern: new RegExp(String.raw`^\s*["']?users\.anonymous\.enabled["']?\s*:\s*["']?true\b|^\s*["']?server\.disable\.auth["']?\s*:\s*["']?true\b|${flag("disable-auth").source}`),
    context: /\bargo/i
  },
  // Prometheus's admin API deletes series and snapshots data for anyone who reaches it.
  { label: "Prometheus's admin API", pattern: new RegExp(`${flag("web\\.enable-admin-api").source}|^\\s*enableAdminAPI\\s*:\\s*true\\b`) },
  // Consul's ACLs that allow every request no rule denies.
  { label: "Consul with ACLs that allow every request by default", pattern: /\b(?:acl_)?default_policy["']?\s*[:=]\s*["']?allow\b/, context: /\bconsul\b|\bacl\b/i },
  // Traefik's dashboard and API on an open entry point.
  { label: "Traefik's API and dashboard without login", pattern: /^\s*insecure\s*[:=]\s*true\b/, under: [/^\s*(?:api\s*:|\[api\])\s*$/] },
  { label: "Traefik's API and dashboard without login", pattern: flag("api\\.insecure") },
  // Bitnami's etcd image without authentication.
  { label: "etcd without authentication", pattern: /\bALLOW_NONE_AUTHENTICATION["']?\s*[:=]\s*["']?yes\b/i },
  // Kong's Admin API, which has no login without Kong Enterprise's RBAC, on every interface.
  { label: "Kong's Admin API on every interface", pattern: /\b(?:KONG_ADMIN_LISTEN|admin_listen)["']?\s*[:=]\s*["']?(?:0\.0\.0\.0|\[::\]):\d/i }
];
const underWindow = 3;
// A template branch that only runs in development mode, as in Vault's Helm chart.
const developmentBranch = /\{\{-?\s*(?:else\s+)?if\b[^}]*(?:\bdev\b|"dev"|\.dev\.enabled)/;

const settingsFile =
  /\.(?:ya?ml|tpl|j2|json|hcl|tf|toml|conf|cfg|ini|env|properties|xml|py|sh|bash|zsh|groovy)$|(?:^|\/)(?:Dockerfile[^/]*|[^/]*\.dockerfile|Containerfile|Makefile|Procfile|\.env(?:\.[\w-]+)?)$/i;
// CI service containers and development setups are thrown away after a run.
// End-to-end test setups, `hack` scripts, and documentation's sample configurations are not deployed.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e|integtest)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\/|(?:^|\/)(?:molecule|\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer|azure-pipelines[^/]*|bitbucket-pipelines[^/]*)(?:\/|$)|(?:^|\/)(?:docker-)?compose\.override\.ya?ml$/i;
const commentLine = /^\s*(?:#|\/\/|;|<!--|\*|\{\{-?\s*\/\*)/;
// Schemas, CRDs, and flag descriptions that name a setting without setting it.
const describesValues = /["']?(?:description|help|usage|examples?|name)["']?\s*[:=]/i;
// Kubernetes' `- name: VAULT_DEV_ROOT_TOKEN_ID` with `value: root` on the next line, read as one setting.
const envName = /^\s*-?\s*name\s*:\s*["']?([A-Z][A-Z0-9_]*)["']?\s*$/;
const envValue = /^\s*value\s*:\s*(.+)$/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const opsToolAuthRule: Rule = {
  id: "ops-tool-auth",
  description: "Flags operations tools started without login, such as Jenkins, the Kubernetes Dashboard, Argo CD, Vault's development server, and Prometheus's admin API.",
  run({ files, config }) {
    if (!config.rules.opsToolAuth.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !settingsFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test setups run on a developer's machine.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = `${file.path}\n${lines.map(({ content }) => content).join("\n")}`;
      const active = settings.filter(({ context }) => context === undefined || context.test(text));
      const found: Array<{ line: number; label: string; high: boolean }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (lines.slice(Math.max(0, index - underWindow), index).some(({ content: other }) => developmentBranch.test(other))) {
          return;
        }
        const name = envName.exec(content)?.[1];
        const value = name === undefined ? undefined : envValue.exec(lines[index + 1]?.content ?? "")?.[1];
        if (name !== undefined && value !== undefined) {
          const setting = active.find(({ pattern, under }) => under === undefined && pattern.test(`${name}: ${value.trim()}`));
          if (setting !== undefined) {
            found.push({ line, label: setting.label, high: setting.high === true });
          }
          return;
        }
        if (describesValues.test(content)) {
          return;
        }
        const before = lines.slice(Math.max(0, index - underWindow), index).map(({ content: other }) => other);
        const setting = active.find(({ pattern, under }) => pattern.test(content) && (under === undefined || under.every((parent) => before.some((other) => parent.test(other)))));
        if (setting !== undefined) {
          found.push({ line, label: setting.label, high: setting.high === true });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "ops-tool-auth",
          title: "Operations tool open without login",
          severity: found.some(({ high }) => high) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "open" : "opens"} ${listOf(labels)} to anyone who can reach ${plural || labels.length > 1 ? "them" : "it"}, and these tools deploy code, run scripts, read secrets, or delete data.`,
          recommendation:
            "Keep login on and give anonymous users no role: turn Jenkins's security on, leave `AUTH_ROLE_PUBLIC` unset, run Vault as a server with sealed storage, keep the Kubernetes Dashboard's and Argo CD's login, set Consul's `default_policy` to `deny`, and bind Prometheus's admin API, Traefik's API, and Kong's Admin API to localhost or put them behind authentication."
        }
      ];
    });
  }
};
