import { patchLines, type PatchLine } from "../analysis/added-lines.js";

// A credential found in a Kubernetes Secret manifest or a Kustomize secret generator, by its key.
export type KubernetesSecretLine = { line: number; key: string };

const yamlFile = /\.ya?ml$/i;
const kustomization = /(?:^|\/)kustomization\.ya?ml$/i;

const secretKind = /^kind:\s*["']?Secret["']?\s*(?:#.*)?$/;
// Secrets encrypted with SOPS, and service account tokens that Kubernetes fills in.
const encrypted = /^sops:\s*$|\bENC\[[A-Z0-9_]+,/;
const tokenType = /^type:\s*["']?kubernetes\.io\/service-account-token["']?\s*$/;
const dataSection = /^(data|stringData):\s*(?:#.*)?$/;
// A key, which a Helm template may also build, such as `{{ .Release.Name }}-kubeconfig:`.
const entry = /^(\s+)("[^"]+"|'[^']+'|[^\s#'"][^:]*?)\s*:(?:\s+(.*))?$/;
const blockScalar = /^[|>][-+0-9]*\s*(?:#.*)?$/;
const secretGenerator = /^secretGenerator:\s*$/;
const literal = /^\s*-\s*["']?([\w.-]+)=(.*?)["']?\s*$/;

// Values filled in at deploy time, by Helm, Kustomize, envsubst, Terraform, or Ansible.
export const templated = /\{\{|\$\{|\$\(|<%|\(\(|%\{|#\{/;
// Placeholders that stand for a value to supply, and empty values.
export const placeholder =
  /^(?:|<[^>]*>|\[[^\]]*\]|\*+|\.{3}|-|null|~|none|changeme|change[-_ ]?(?:me|it|this)|replace[-_ ]?(?:me|this)?|placeholder|example|todo|tbd|redacted|dummy|fake|sample|secret|password|(?:your|insert|enter|replace[-_ ]?with)[-_ ].*|base64[-_ ]?encoded.*|.*x{3,}.*)$/i;
// Keys that name a password, token, key, or other credential. Other keys, such as `username`,
// `clientID`, or `tls.crt`, hold values that are not secret on their own.
const secretKey =
  /pass(?:word|wd|phrase)?|pwd|secret|token|api[-_.]?key|access[-_.]?key|private[-_.]?key|(?:^|[-_.])key(?:[-_.]?pem)?$|credential|htpasswd|dockerconfigjson|dockercfg|(?:^|[-_.])auth$|salt|signing/i;
// Values that are credentials whatever their key: private keys, URLs with a password, and config
// files with a credential line.
const privateKey = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const urlPassword = /:\/\/[^\/\s:@]+:[^\/\s@]+@/;
const credentialLine = /^\s*["']?[\w.-]*(?:pass(?:word|wd)?|secret|token|api[-_]?key|private[-_]?key)["']?\s*[:=]\s*["']?([^"'\s#][^"'#]*)["']?\s*(?:#.*)?$/gim;
const base64 = /^[A-Za-z0-9+/]+={0,2}$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  if (/^"[^"]*"$|^'[^']*'$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "");
}

// A Secret's value as text, decoding `data`'s base64, or undefined when it is empty, templated, or a
// placeholder.
function realValue(value: string, encoded: boolean): string | undefined {
  const compact = value.replace(/\s+/g, "");
  if (templated.test(value) || placeholder.test(value.trim()) || placeholder.test(compact)) {
    return undefined;
  }
  if (!encoded) {
    return value;
  }
  if (!base64.test(compact)) {
    return undefined;
  }
  const decoded = Buffer.from(compact, "base64").toString("utf8").trim();
  return templated.test(decoded) || placeholder.test(decoded) ? undefined : decoded;
}

// Whether a key and its value hold a credential.
function holdsCredential(key: string, value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  if (secretKey.test(key) || privateKey.test(value) || urlPassword.test(value)) {
    return true;
  }
  return [...value.matchAll(credentialLine)].some((match) => realValue(match[1] ?? "", false) !== undefined);
}

// The `data` and `stringData` entries of one YAML document, with the line of each key.
function secretEntries(document: PatchLine[]): Array<{ key: string; line: PatchLine }> {
  const contents = document.map(({ content }) => content);
  if (!contents.some((content) => secretKind.test(content)) || contents.some((content) => encrypted.test(content) || tokenType.test(content))) {
    return [];
  }

  const found: Array<{ key: string; line: PatchLine }> = [];
  let section: string | undefined;
  let entryIndent: number | undefined;
  for (let index = 0; index < document.length; index += 1) {
    const content = contents[index] ?? "";
    if (content.trim() === "" || /^\s*#/.test(content)) {
      continue;
    }
    const sectionMatch = dataSection.exec(content);
    if (sectionMatch !== null) {
      section = sectionMatch[1];
      entryIndent = undefined;
      continue;
    }
    if (!/^\s/.test(content)) {
      section = undefined;
      continue;
    }
    const match = entry.exec(content);
    if (section === undefined || match === null) {
      continue;
    }
    const indent = match[1]?.length ?? 0;
    entryIndent ??= indent;
    if (indent !== entryIndent) {
      continue;
    }
    const key = (match[2] ?? "").replace(/^["']|["']$/g, "");
    const rawValue = match[3] ?? "";
    const line = document[index];
    if (line === undefined) {
      continue;
    }
    if (blockScalar.test(rawValue.trim())) {
      // A block scalar's value is the more indented lines that follow.
      const block: PatchLine[] = [];
      while (index + 1 < document.length && ((contents[index + 1] ?? "").trim() === "" || /^\s/.test(contents[index + 1] ?? "")) && leadingSpaces(contents[index + 1] ?? "") > indent) {
        index += 1;
        const next = document[index];
        if (next !== undefined) {
          block.push(next);
        }
      }
      const value = block.map(({ content: text }) => text.trim()).join("\n");
      if (holdsCredential(key, realValue(value, section === "data")) && (line.added || block.some(({ added }) => added))) {
        found.push({ key, line });
      }
      continue;
    }
    if (line.added && holdsCredential(key, realValue(unquote(rawValue), section === "data"))) {
      found.push({ key, line });
    }
  }
  return found;
}

function leadingSpaces(content: string): number {
  return content.trim() === "" ? Number.POSITIVE_INFINITY : (/^\s*/.exec(content)?.[0].length ?? 0);
}

// Kustomize's `secretGenerator` entries with `literals`, such as `- password=s3cret`.
function generatorLiterals(lines: PatchLine[]): Array<{ key: string; line: PatchLine }> {
  const found: Array<{ key: string; line: PatchLine }> = [];
  let inGenerator = false;
  let inLiterals = false;
  for (const line of lines) {
    const { content } = line;
    if (line.startsHunk) {
      inGenerator = false;
      inLiterals = false;
    }
    if (content.trim() === "" || /^\s*#/.test(content)) {
      continue;
    }
    if (!/^\s/.test(content) && !/^-/.test(content)) {
      inGenerator = secretGenerator.test(content);
      inLiterals = false;
      continue;
    }
    if (!inGenerator) {
      continue;
    }
    if (/^\s*-?\s*literals:\s*$/.test(content)) {
      inLiterals = true;
      continue;
    }
    if (/^\s*-?\s*[\w-]+:/.test(content)) {
      inLiterals = false;
      continue;
    }
    const match = literal.exec(content);
    if (inLiterals && match !== null && line.added && holdsCredential(match[1] ?? "", realValue(match[2] ?? "", false))) {
      found.push({ key: match[1] ?? "", line });
    }
  }
  return found;
}

// Added lines that put a credential in a Kubernetes Secret's `data` or `stringData`, or in a
// Kustomize secret generator's `literals`. Runs before redaction, which hides the values.
export function findKubernetesSecretLines(path: string, patch: string): KubernetesSecretLine[] {
  if (!yamlFile.test(path)) {
    return [];
  }
  const lines = patchLines(patch);
  // YAML documents end at `---`; a new hunk may start in another document.
  const documents: PatchLine[][] = [[]];
  for (const line of lines) {
    if (/^---\s*(?:#.*)?$/.test(line.content) || (line.startsHunk && (documents.at(-1)?.length ?? 0) > 0)) {
      documents.push([]);
    }
    if (!/^---/.test(line.content)) {
      documents.at(-1)?.push(line);
    }
  }
  return [...documents.flatMap((document) => secretEntries(document)), ...(kustomization.test(path) ? generatorLiterals(lines) : [])].map(
    ({ key, line }) => ({ line: line.line, key })
  );
}
