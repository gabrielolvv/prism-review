import { addedLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";

// Files that hold credentials by their nature, whatever their content.
const wholeFileKinds: Array<[string, RegExp]> = [
  ["a private key", /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$|\.ppk$|(?:^|\/)(?:privkey[^/]*|(?:[^/]*[-_])?(?<!pub(?:lic)?[-_])key)\.pem$/i],
  ["a key store", /\.(?:p12|pfx|jks|keystore|bks)$/i],
  ["a Terraform state file", /\.tfstate(?:\.backup)?$/i],
  ["a credentials file", /(?:^|\/)(?:\.git-credentials|\.netrc|_netrc|\.pgpass|\.htpasswd)$|(?:^|\/)\.aws\/credentials$/i],
  ["a Docker credentials file", /(?:^|\/)\.docker\/config\.json$/i],
  ["a Kubernetes config file", /(?:^|\/)\.kube\/config$|(?:^|\/)kubeconfig$|\.kubeconfig$/i],
  ["a cloud service account key", /(?:^|\/)(?:service[-_]?account|client_secret)[^/]*\.json$/i]
];

// `.env`, `.env.production`, and `prod.env`, but not `.env.example` and the like.
// `.key` is also Keynote's extension, so only text files count; GitHub sends no patch for binaries.
const keyFile = /\.key$/i;

const environmentFile = /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.env)$/i;
const exampleFile = /(?:^|[./])(?:example|sample|template|tmpl|tpl|dist|defaults?|schema)(?:[./]|$)/i;
const registryFile = /(?:^|\/)(?:\.npmrc|\.yarnrc(?:\.yml)?|\.pypirc)$/i;


const commentLine = /^\s*[#;]/;
const assignment = /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*[=:]\s*(.*)$/;
// The name must end with the secret word, so `TOKEN_TTL_SECONDS` and `MAX_TOKENS` do not count, and
// `PWD` is the working directory.
const secretName =
  /(?:secret|passw(?:or)?d|[_.-]pass|[_.-]pwd|token|credentials?|(?:api|private|access|secret|signing|encryption|master)[_.-]?key|secret[_.-]?key[_.-]?base)$/i;
// Build tools inline these into code sent to browsers, so they are public by design.
const publicName = /^(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|GATSBY_|PUBLIC_)/i;
const urlPassword = /\b[a-z][\w+.-]*:\/\/[^\s:@/]+:([^\s@/]+)@(\[[^\]\s]*\]|[^\s:/?#]+)/i;
const localHost = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)$/i;
const registryToken = /(?:_authToken|_auth|_password|npmAuthToken|npmAuthIdent)\s*[=:]\s*(.*)$|^\s*password\s*[=:]\s*(.*)$/i;
// Empty values, references to other variables, and the values examples use.
const placeholder =
  /^(?:|\$\{?[\w:-]*\}?|<[^>]*>|x+|\*+|\.{3}|change[_-]?me|replace[_-]?me|your[\w-]*|placeholder|example|todo|tbd|none|null|true|false|\d)$/i;
// A path names the file that holds the credential, as `GOOGLE_APPLICATION_CREDENTIALS` does.
// Base64 values can start with `/` too, so a path needs a directory or an extension and no `+` or `=`.
const filePath = /^(?:~|\.{1,2})?\/[\w.-]+(?:\/[\w.-]+)+$|^(?:~\/|\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:json|pem|key|p12|pfx|jks|crt)$/i;
// Defaults that local development setups, such as a Docker Compose database, commit on purpose.
const localDefault = /^(?:password|passw0rd|pass|secret|postgres|mysql|root|admin|guest|dev|development|test|local|default|123456)$/i;

export type CredentialFileKind = {
  // Completes "This is ..." in the finding.
  name: string;
  // True for file types that are only a problem when an added line holds a credential.
  checksLines: boolean;
  // Only counts when GitHub sends a text patch.
  textOnly?: boolean;
};

// Undefined means the file is not a credential file.
export function credentialFileKind(path: string): CredentialFileKind | undefined {
  if (isTestDataPath(path)) {
    return undefined;
  }
  if (environmentFile.test(path)) {
    return exampleFile.test(path.slice(path.lastIndexOf("/") + 1))
      ? undefined
      : { name: "an environment file", checksLines: true };
  }
  if (registryFile.test(path)) {
    return { name: "a package manager configuration file", checksLines: true };
  }
  if (keyFile.test(path)) {
    return { name: "a key file", checksLines: false, textOnly: true };
  }
  const name = wholeFileKinds.find(([, pattern]) => pattern.test(path))?.[0];
  return name === undefined ? undefined : { name, checksLines: false };
}

// The added lines that hold a credential, in a file whose kind checks lines. Runs before
// redaction, which replaces values such as `${NPM_TOKEN}` that tell a reference from a secret.
export function findCredentialLines(path: string, patch: string): number[] {
  const check = registryFile.test(path) ? registrySecret : environmentSecret;
  return addedLines(patch)
    .filter(({ content }) => !commentLine.test(content) && check(content))
    .map(({ line }) => line);
}

function environmentSecret(content: string): boolean {
  const match = assignment.exec(content);
  if (!match) {
    return false;
  }
  const [, name = "", raw = ""] = match;
  const value = cleanValue(raw);

  const url = urlPassword.exec(value);
  if (url) {
    return !isPlaceholder(url[1] ?? "") && !localHost.test(url[2] ?? "");
  }
  return secretName.test(name) && !publicName.test(name) && !isPlaceholder(value);
}

function registrySecret(content: string): boolean {
  const match = registryToken.exec(content);
  return match !== null && !isPlaceholder(cleanValue(match[1] ?? match[2] ?? ""));
}

function isPlaceholder(value: string): boolean {
  return placeholder.test(value) || localDefault.test(value) || filePath.test(value);
}

// Drops a trailing comment from an unquoted value, and the quotes around a quoted one.
function cleanValue(raw: string): string {
  const value = raw.trim();
  const quoted = /^(["'])(.*)\1/.exec(value);
  if (quoted) {
    return quoted[2] ?? "";
  }
  return value.replace(/\s+#.*$/, "");
}
