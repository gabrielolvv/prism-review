import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isPlaceholder, publicName, secretName } from "./credential-files.js";
import { placeholder, templated } from "./kubernetes-secrets.js";

// A secret written into a deployment's environment, by its variable name.
export type EnvSecretLine = { line: number; name: string };

const yamlFile = /\.ya?ml$/i;
// Kubernetes, ECS task definitions, Terraform, and CloudFormation, which list variables as
// `name` and `value` pairs.
const pairFile = /\.(?:ya?ml|json|tf|hcl)$/i;
const composeFile = /(?:^|\/)(?:docker-)?compose[^/]*\.ya?ml$/i;
// Compose files are deployments only where their path says so; most set up a developer's machine.
const productionPath = /(?:^|[\/_.-])(?:prod|production|stack|deploy|deployment|release|live|swarm)(?:[\/_.-]|$)/i;

// `- name: DB_PASSWORD`, `"name": "DB_PASSWORD",`, and `name = "DB_PASSWORD"`.
const pairName = /^\s*-?\s*\{?\s*["']?name["']?\s*[:=]\s*["']?([A-Za-z_][\w.-]*)["']?\s*,?\s*(?:#.*)?$/;
// `{ name: DB_PASSWORD, value: s3cret }` on one line.
const inlinePair = /\{\s*["']?name["']?\s*[:=]\s*["']?([A-Za-z_][\w.-]*)["']?\s*,\s*["']?value["']?\s*[:=]\s*(.+?)\s*\}/;
const pairValue = /^\s*["']?value["']?\s*[:=]\s*(.+?)\s*,?\s*$/;
const pairWindow = 3;
// The list or map the variables sit in: Kubernetes' `env:`, ECS's `"environment": [`, and
// Terraform's `environment = [`.
const environmentKey = /["']?\b(?:env|environment|environmentVariables)["']?\s*[:=]/;
const environmentWindow = 15;

// Compose's `environment:`, App Engine's `env_variables:`, and Cloud Foundry's and Helm values'
// `env:` maps, whose entries are upper-case variable names.
const mapStart = /^(\s*)(?:environment|env_variables|env|envVars|extraEnv)\s*:\s*(?:#.*)?$/;
const mapEntry = /^\s*["']?([A-Z][A-Z0-9_]*)["']?\s*:\s*(.+?)\s*$/;
const listEntry = /^\s*-\s*["']?([A-Z][A-Z0-9_]*)=(.*?)["']?\s*$/;

// Values read from a secret store, and switches and numbers rather than secrets.
const secretReference = /^(?:vault:|arn:|ssm:|sm:\/\/|gcp:|projects\/[^/\s]+\/secrets\/|op:\/\/|akv:\/\/|keyvault:)/i;
const notSecret = /^(?:true|false|yes|no|on|off|enabled?|disabled?|required|optional|none|\d{1,6}|seconds|minutes|hours|days|weeks)$/i;
// Values that mark a test or an example, say there is no secret, such as `NO_TOKEN`, or are a
// default such as `password1`.
const sampleValue = /test|example|dummy|sample|fake|xyzzy|foobar|hunter2|^(?:no|not)[-_ ]?(?:set|token|password|secret|key|value)$|^(?:password|passwd|secret|admin|root)\d*!?$/i;
// Paths and names that say where a secret is kept, such as `/grafana/%s/api_key`.
const storagePath = /^\/?[\w.%-]+(?:\/[\w.%-]+)+\/?$/;
const sampleName = /^(?:example|sample|dummy|fake|test|mock)[-_]/i;
// Names that hold a setting about a secret rather than the secret itself.
const settingName = /_(?:FILE|PATH|DIR|NAME|ID|TTL|EXPIRY|EXPIRES?|LENGTH|HEADER|URL|URI|ENDPOINT|HOST|PORT|ENABLED|REQUIRED|TYPE|ALGORITHM|MODE|SECONDS|DAYS|HOURS|MINUTES)$|^(?:MIN|MAX)_/i;

function cleanValue(raw: string): string {
  const value = raw.trim();
  const quoted = /^(["'])(.*?)\1/.exec(value);
  if (quoted !== null) {
    return quoted[2] ?? "";
  }
  return value.replace(/\s+#.*$/, "").replace(/,$/, "").trim();
}

// Whether a variable is named like a secret and given a real value, not a reference, a template,
// a placeholder, or a local default. URLs with a password are left to `url-credentials`. Values that
// start with `!` are YAML tags, such as CloudFormation's `!Ref` or Ansible's `!vault`.
export function isSecretValue(name: string, raw: string): boolean {
  if (!secretName.test(name) || publicName.test(name) || settingName.test(name) || sampleName.test(name)) {
    return false;
  }
  const value = cleanValue(raw);
  return (
    value.length >= 4 &&
    !/^[|>[{!]/.test(value) &&
    !value.includes("://") &&
    !templated.test(value) &&
    !secretReference.test(value) &&
    !notSecret.test(value) &&
    !sampleValue.test(value) &&
    !storagePath.test(value) &&
    !placeholder.test(value) &&
    !isPlaceholder(value)
  );
}

// `name` and `value` pairs inside an environment list.
function pairSecrets(lines: PatchLine[]): EnvSecretLine[] {
  const found: EnvSecretLine[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (/^\s*(?:#|\/\/)/.test(content)) {
      return;
    }
    const near = lines.slice(Math.max(0, index - environmentWindow), index + 1);
    if (!near.some(({ content: before }) => environmentKey.test(before))) {
      return;
    }
    const inline = inlinePair.exec(content);
    if (inline !== null) {
      if (added && isSecretValue(inline[1] ?? "", inline[2] ?? "")) {
        found.push({ line, name: inline[1] ?? "" });
      }
      return;
    }
    const name = pairName.exec(content);
    if (name === null) {
      return;
    }
    // The value follows the name within the same entry; `valueFrom` reads a secret instead.
    for (const next of lines.slice(index + 1, index + 1 + pairWindow)) {
      if (pairName.test(next.content) || /^\s*-\s/.test(next.content) || /\bvalueFrom\b/.test(next.content)) {
        return;
      }
      const value = pairValue.exec(next.content);
      if (value !== null) {
        if ((added || next.added) && isSecretValue(name[1] ?? "", value[1] ?? "")) {
          found.push({ line: next.line, name: name[1] ?? "" });
        }
        return;
      }
    }
  });
  return found;
}

// Entries of `environment:` and `env:` maps, and of Compose's `- NAME=value` lists.
function mapSecrets(lines: PatchLine[]): EnvSecretLine[] {
  const found: EnvSecretLine[] = [];
  let mapIndent: number | undefined;
  for (const { line, content, added, startsHunk } of lines) {
    if (startsHunk) {
      mapIndent = undefined;
    }
    if (content.trim() === "" || /^\s*#/.test(content)) {
      continue;
    }
    const start = mapStart.exec(content);
    if (start !== null) {
      mapIndent = start[1]?.length ?? 0;
      continue;
    }
    const indent = /^\s*/.exec(content)?.[0].length ?? 0;
    if (mapIndent === undefined || indent <= mapIndent) {
      mapIndent = undefined;
      continue;
    }
    const entry = mapEntry.exec(content) ?? listEntry.exec(content);
    if (entry !== null && added && isSecretValue(entry[1] ?? "", entry[2] ?? "")) {
      found.push({ line, name: entry[1] ?? "" });
    }
  }
  return found;
}

// Added lines that write a secret into a deployment's environment in plain text. Runs before
// redaction, which hides the values.
export function findDeploymentEnvSecretLines(path: string, patch: string): EnvSecretLine[] {
  if (!pairFile.test(path) || (composeFile.test(path) && !productionPath.test(path))) {
    return [];
  }
  const lines = patchLines(patch);
  const found = [...pairSecrets(lines), ...(yamlFile.test(path) ? mapSecrets(lines) : [])];
  const byLine = new Map(found.map((secret) => [secret.line, secret]));
  return [...byLine.values()].sort((left, right) => left.line - right.line);
}
