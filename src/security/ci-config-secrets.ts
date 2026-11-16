import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isSecretValue } from "./deployment-env-secrets.js";

// A secret written into a CI pipeline's configuration, by the variable or input that holds it.
export type CiSecretLine = { line: number; name: string };

const yamlPipeline =
  /(?:^|\/)(?:\.github\/workflows\/[^/]+|\.gitlab-ci|\.gitlab-ci\/[^/]+|\.gitlab\/ci\/[^/]+|\.circleci\/config|azure-pipelines[^/]*|\.azure-pipelines\/[^/]+|\.drone|\.woodpecker|\.woodpecker\/[^/]+|\.travis|bitbucket-pipelines|appveyor|\.buildkite\/pipeline[^/]*)\.ya?ml$/i;
const jenkinsfile = /(?:^|\/)Jenkinsfile[^/]*$|\.jenkinsfile$/i;

// GitHub Actions' `env:` and `with:`, GitLab's and Azure Pipelines' `variables:`, CircleCI's, Drone's,
// and Woodpecker's `environment:`, and Travis's `env:` with `global:`.
const blockStart = /^(\s*)-?\s*(?:env|environment|variables|with|global)\s*:\s*(?:#.*)?$/;
// Service containers, such as a Postgres database that the tests use, run only for the job.
const servicesStart = /^(\s*)services\s*:\s*(?:#.*)?$/;
const mapEntry = /^\s*["']?([A-Za-z_][\w.-]*)["']?\s*:\s*(.*?)\s*$/;
const listEntry = /^\s*-\s*["']?([A-Za-z_]\w*)=(.*?)["']?\s*$/;
const pairName = /^\s*-\s*name\s*:\s*["']?([A-Za-z_][\w.-]*)["']?\s*$/;
const pairValue = /^\s*value\s*:\s*(.+?)\s*$/;
const pairWindow = 3;
// Passwords for the database and broker images that a job starts for its tests.
const disposableService =
  /^(?:POSTGRES|PG|MYSQL(?:_ROOT)?|MARIADB(?:_ROOT)?|MONGO(?:_INITDB_ROOT)?|REDIS|RABBITMQ_DEFAULT|MSSQL_SA|SA|MINIO_ROOT|ELASTIC|CLICKHOUSE|NEO4J|KEYCLOAK_ADMIN|ORACLE|DB2INST1)_?PASS(?:WORD)?$/i;
// Names of secrets kept elsewhere, such as `image-pull-secret: registry` or Drone's `from_secret`,
// and FOSSA's push-only API keys, which FOSSA documents as safe to publish in CI files.
const referenceName = /^from_secret$|(?:pull|image|tls|registry)[-_]?secrets?$|secret[-_]?(?:name|ref|id)$|^fossa[-_]?api[-_]?key$/i;
// Jenkins' `JOB_CREDENTIALS = 'credential-id'` names a credential in Jenkins' store.
const jenkinsCredentialId = /CREDENTIALS?(?:_ID)?$/i;
// Jenkins' `environment { NAME = 'value' }`.
const jenkinsEnvironment = /^\s*environment\s*\{\s*$/;
const jenkinsEntry = /^\s*([A-Za-z_]\w*)\s*=\s*(["'])((?:(?!\2)[^\\]|\\.)*)\2\s*$/;
const commentLine = /^\s*(?:#|\/\/)/;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

function yamlSecrets(lines: PatchLine[]): CiSecretLine[] {
  const found: CiSecretLine[] = [];
  let blockIndent: number | undefined;
  let entryIndent: number | undefined;
  let servicesIndent: number | undefined;
  const report = (name: string, value: string, line: PatchLine) => {
    if (line.added && !disposableService.test(name) && !referenceName.test(name) && isSecretValue(name, value)) {
      found.push({ line: line.line, name });
    }
  };
  lines.forEach((line, index) => {
    const { content, startsHunk } = line;
    if (startsHunk) {
      blockIndent = undefined;
      entryIndent = undefined;
      servicesIndent = undefined;
    }
    if (content.trim() === "" || commentLine.test(content)) {
      return;
    }
    const indent = indentOf(content);
    if (servicesIndent !== undefined && indent <= servicesIndent) {
      servicesIndent = undefined;
    }
    if (blockIndent !== undefined && indent <= blockIndent) {
      blockIndent = undefined;
      entryIndent = undefined;
    }
    const services = servicesStart.exec(content);
    if (services !== null) {
      servicesIndent = services[1]?.length ?? 0;
      return;
    }
    const block = blockStart.exec(content);
    if (block !== null) {
      blockIndent = block[1]?.length ?? 0;
      entryIndent = undefined;
      return;
    }
    if (blockIndent === undefined || servicesIndent !== undefined) {
      return;
    }
    // Entries sit at the block's first indent; deeper lines belong to an entry, such as Drone's
    // `from_secret:` or GitLab's `value:`, and are read with it.
    entryIndent ??= indent;
    if (indent !== entryIndent) {
      return;
    }
    // Azure Pipelines' `- name: ...` and `value: ...`.
    const name = pairName.exec(content);
    if (name !== null) {
      const value = lines.slice(index + 1, index + 1 + pairWindow).find(({ content: next }) => pairValue.test(next));
      if (value !== undefined) {
        report(name[1] ?? "", pairValue.exec(value.content)?.[1] ?? "", { ...value, added: line.added || value.added });
      }
      return;
    }
    const entry = listEntry.exec(content) ?? mapEntry.exec(content);
    if (entry === null) {
      return;
    }
    const [, key = "", raw = ""] = entry;
    if (raw === "" || raw.startsWith("#")) {
      // GitLab's `NAME:` with `value:` and `description:` below it.
      const value = lines.slice(index + 1, index + 1 + pairWindow).find(({ content: next }) => indentOf(next) > indent && pairValue.test(next));
      if (value !== undefined) {
        report(key, pairValue.exec(value.content)?.[1] ?? "", value);
      }
      return;
    }
    report(key, raw, line);
  });
  return found;
}

function jenkinsSecrets(lines: PatchLine[]): CiSecretLine[] {
  const found: CiSecretLine[] = [];
  let inEnvironment = false;
  for (const { line, content, added, startsHunk } of lines) {
    if (startsHunk) {
      inEnvironment = false;
    }
    if (jenkinsEnvironment.test(content)) {
      inEnvironment = true;
      continue;
    }
    if (inEnvironment && /^\s*\}/.test(content)) {
      inEnvironment = false;
      continue;
    }
    const entry = inEnvironment ? jenkinsEntry.exec(content) : null;
    if (entry !== null && added && !jenkinsCredentialId.test(entry[1] ?? "") && isSecretValue(entry[1] ?? "", entry[3] ?? "")) {
      found.push({ line, name: entry[1] ?? "" });
    }
  }
  return found;
}

// Added lines that write a secret into a CI pipeline's configuration instead of reading it from the
// CI's secret store. Runs before redaction, which hides the values.
export function findCiConfigSecretLines(path: string, patch: string): CiSecretLine[] {
  if (yamlPipeline.test(path)) {
    return yamlSecrets(patchLines(patch));
  }
  if (jenkinsfile.test(path)) {
    return jenkinsSecrets(patchLines(patch));
  }
  return [];
}
