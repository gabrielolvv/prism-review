import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Setting = { label: string; high?: boolean; pattern: RegExp };

// Services started with authentication turned off, in configuration files, Compose and Kubernetes
// files, Dockerfiles, environment files, and shell scripts.
const settings: Setting[] = [
  // The Docker daemon on TCP without TLS lets anyone who reaches the port run containers as root.
  { label: "the Docker daemon on TCP without TLS", high: true, pattern: /(?:-H\s*|--host[=\s]\s*|["']hosts["']\s*:\s*\[[^\]]*["'])tcp:\/\/(?:0\.0\.0\.0|\[::\]|)?:2375\b/ },
  // Jupyter with an empty token runs code for anyone who reaches it.
  {
    label: "Jupyter without a token",
    high: true,
    pattern: /--(?:NotebookApp|ServerApp|IdentityProvider)\.token\s*=\s*(?:["']{2}|(?=\s|$))|\bc\.(?:NotebookApp|ServerApp|IdentityProvider)\.token\s*=\s*["']{2}/
  },
  {
    label: "Elasticsearch or OpenSearch security",
    pattern: /\bxpack\.security\.enabled["']?\s*[:=]\s*["']?false\b|\bplugins\.security\.disabled["']?\s*[:=]\s*["']?true\b|\bDISABLE_SECURITY_PLUGIN["']?\s*[:=]\s*["']?true\b/i
  },
  { label: "Redis protected mode", pattern: /^\s*protected-mode\s+no\b|--protected-mode\s+no\b/ },
  { label: "MongoDB authentication", pattern: /--noauth\b(?!_)|^\s*authorization\s*:\s*["']?disabled\b/ },
  {
    label: "Postgres password checks",
    pattern: /\bPOSTGRES_HOST_AUTH_METHOD["']?\s*[:=]\s*["']?trust\b|^\s*host(?:ssl|nossl)?\s+\S+\s+\S+\s+(?:0\.0\.0\.0\/0|::\/0|all)\s+trust\b/
  },
  {
    label: "MySQL or MariaDB passwords",
    pattern: /\b(?:MYSQL_ALLOW_EMPTY_PASSWORD|MARIADB_ALLOW_EMPTY_ROOT_PASSWORD|MARIADB_ALLOW_EMPTY_PASSWORD|ALLOW_EMPTY_PASSWORD)["']?\s*[:=]\s*["']?(?:yes|true|1)\b|\bskip[-_]grant[-_]tables\b/i
  },
  { label: "anonymous admin access in Grafana", pattern: /\bGF_AUTH_ANONYMOUS_ORG_ROLE["']?\s*[:=]\s*["']?(?:Admin|Editor)\b/ },
  { label: "the RabbitMQ guest account's localhost limit", pattern: /\bloopback_users(?:\.guest)?\s*=\s*(?:false|none)\b/ },
  { label: "Kafka's and ZooKeeper's access control", pattern: /\ballow\.everyone\.if\.no\.acl\.found\s*=\s*true\b|\bALLOW_ANONYMOUS_LOGIN["']?\s*[:=]\s*["']?yes\b/i },
  { label: "kubelet authentication", pattern: /--anonymous-auth=true\b|--authorization-mode=AlwaysAllow\b/ }
];

// Files that configure services: Compose, Kubernetes, and Helm YAML, Dockerfiles, environment and
// configuration files, systemd units, Docker's daemon.json, Jupyter's config, and shell scripts.
const serviceFile =
  /\.(?:ya?ml|conf|cnf|ini|env|sh|bash|service|toml|properties|json)$|(?:^|\/)(?:Dockerfile[^/]*|[^/]*\.dockerfile|\.env(?:\.[^/]*)?|pg_hba\.conf|redis\.conf|mongod\.conf|my\.cnf|daemon\.json|jupyter_(?:notebook|server)_config\.py|Procfile|Makefile)$/i;
// CI service containers, test containers, and development setups are thrown away after a run.
const ciOrTestSetup =
  /(?:^|\/)(?:\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer|azure-pipelines[^/]*|bitbucket-pipelines[^/]*|Jenkinsfile[^/]*|testcontainers[^/]*)(?:\/|$)|(?:^|\/)(?:docker-)?compose\.override\.ya?ml$/i;

const commentLine = /^\s*(?:#|\/\/|;|<!--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const serviceAuthDisabledRule: Rule = {
  id: "service-auth-disabled",
  description: "Flags data stores, message brokers, notebooks, and the Docker daemon started with authentication turned off.",
  run({ files, config }) {
    if (!config.rules.serviceAuthDisabled.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !serviceFile.test(file.path) ||
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

      const found: Array<{ line: number; setting: Setting }> = [];
      for (const { line, content, added } of patchLines(file.patch)) {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        const setting = settings.find(({ pattern }) => pattern.test(content));
        if (setting !== undefined) {
          found.push({ line, setting });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const lines = found.map(({ line }) => line);
      const labels = [...new Set(found.map(({ setting }) => setting.label))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "service-auth-disabled",
          title: "Service authentication turned off",
          severity: found.some(({ setting }) => setting.high === true) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "turn off" : "turns off"} ${listOf(labels)}, so anyone who can reach the service on the network can read and change its data, or, for Docker and Jupyter, run code on the host.`,
          recommendation:
            "Keep authentication on in every environment that is not a developer's machine: set passwords or keys from a secret store, keep Redis's protected mode and Elasticsearch security on, give Jupyter a token, and serve the Docker daemon over TLS or a local socket only. Put these settings in development-only files, such as `docker-compose.override.yml`, when local setups need them."
        }
      ];
    });
  }
};

// "a", "a and b", or "a, b, and c".
function listOf(items: string[]): string {
  if (items.length <= 2) {
    return items.join(" and ");
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
