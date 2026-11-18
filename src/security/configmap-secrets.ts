import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isSecretValue } from "./deployment-env-secrets.js";
import { dataEntries, generatorLiterals, yamlDocuments } from "./kubernetes-secrets.js";

// A credential found in a Kubernetes ConfigMap or a Kustomize ConfigMap generator, by its key.
export type ConfigMapSecretLine = { line: number; key: string };

const yamlFile = /\.ya?ml$/i;
const kustomization = /(?:^|\/)kustomization\.ya?ml$/i;

const configMapKind = /^kind:\s*["']?ConfigMap["']?\s*(?:#.*)?$/;
const dataSection = /^(data):\s*(?:#.*)?$/;
const configMapGenerator = /^configMapGenerator:\s*$/;
// A setting in a config file kept in the ConfigMap, such as `spring.datasource.password=...`,
// `password: ...`, `"apiKey": "..."`, or `export API_TOKEN=...`.
const fileSetting = /^\s*(?:export\s+)?["']?([\w.-]+)["']?\s*[:=]\s*(.*?)\s*,?\s*$/;

// Settings that name a Secret or a key in one, such as `credentialsSecret: jaeger-creds` or
// `secretKey=signing-secret`, rather than hold a credential: a key about a secret or credential, but
// not a password, set to a lowercase Kubernetes object name made of words.
const referenceKey = /secret|credential/i;
const objectName = /^[a-z][a-z0-9]*(?:[-.][a-z][a-z0-9]*)+$/;
const base64 = /^[A-Za-z0-9+/]{12,}={0,2}$/;

// Whether a value holds a credential under its name: not a reference to a Secret, and, for values
// that are base64-encoded text, also once decoded, so `ZXhhbXBsZS1hcHAtc2VjcmV0` is read as the
// sample value it encodes.
function holdsSecret(name: string, value: string): boolean {
  if (!isSecretValue(name, value) || (referenceKey.test(name) && !/pass|pwd/i.test(name) && objectName.test(value))) {
    return false;
  }
  if (base64.test(value) && value.length % 4 === 0) {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (/^[\x20-\x7e]+$/.test(decoded)) {
      return isSecretValue(name, decoded);
    }
  }
  return true;
}

// The value of a config file setting, without quotes or a trailing comment.
function settingValue(raw: string): string {
  const trimmed = raw.trim();
  const quoted = /^"((?:[^"\\]|\\.)*)"|^'([^']*)'/.exec(trimmed);
  if (quoted !== null) {
    return quoted[1] ?? quoted[2] ?? "";
  }
  return trimmed.replace(/\s+[#;].*$/, "");
}

// A dotted or nested setting's own name, such as `password` in `spring.datasource.password`.
function leafName(key: string): string {
  return key.split(".").at(-1) ?? key;
}

// The lines of one ConfigMap's `data` that hold a credential: a key named like a secret with a
// literal value, or a setting with one in a config file kept under a key.
function configMapEntries(document: PatchLine[]): Array<{ key: string; line: PatchLine }> {
  if (!document.some(({ content }) => configMapKind.test(content))) {
    return [];
  }
  return dataEntries(document, dataSection).flatMap(({ key, line, value, block }) => {
    if (block === undefined) {
      return line.added && holdsSecret(key, value) ? [{ key, line }] : [];
    }
    return block.flatMap((setting) => {
      const match = fileSetting.exec(setting.content);
      if (!setting.added || match === null || /^\s*(?:#|\/\/|;)/.test(setting.content)) {
        return [];
      }
      const name = leafName(match[1] ?? "");
      return holdsSecret(name, settingValue(match[2] ?? "")) ? [{ key: `${key}: ${name}`, line: setting }] : [];
    });
  });
}

// Added lines that put a password, token, or key in a Kubernetes ConfigMap's `data`, or in a
// Kustomize ConfigMap generator's `literals`. Runs before redaction, which hides the values.
export function findConfigMapSecretLines(path: string, patch: string): ConfigMapSecretLine[] {
  if (!yamlFile.test(path)) {
    return [];
  }
  const lines = patchLines(patch);
  const literals = kustomization.test(path) ? generatorLiterals(lines, configMapGenerator).filter(({ key, value }) => holdsSecret(key, value)) : [];
  return [...yamlDocuments(lines).flatMap((document) => configMapEntries(document)), ...literals].map(({ key, line }) => ({ line: line.line, key }));
}
