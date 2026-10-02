import type { ChangedFile, SecretMatch } from "../analysis/changed-file.js";
import { credentialFormats, isAllowlisted } from "./credential-formats.js";

// A private key header is not secret itself, but the key material follows it.
const detectedFormats = [
  ...credentialFormats,
  { kind: "private key", pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g }
];

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// Runs before redaction, which would otherwise hide the values it looks for.
export function detectSecrets(files: ChangedFile[], allowlist: RegExp[] = []): ChangedFile[] {
  return files.map((file) => {
    const secrets = file.patch === undefined ? [] : findAddedSecrets(file.patch, allowlist);
    return secrets.length === 0 ? { ...file } : { ...file, secrets };
  });
}

// Only added lines count: a removed line takes a secret out, and a context line was already there.
export function findAddedSecrets(patch: string, allowlist: RegExp[] = []): SecretMatch[] {
  const secrets: SecretMatch[] = [];
  let newLine: number | undefined;

  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      newLine = Number(header[1]);
      continue;
    }

    // Lines before the first hunk are git headers such as `+++ b/path`.
    if (newLine === undefined || line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+")) {
      for (const kind of matchingKinds(line.slice(1), allowlist)) {
        secrets.push({ line: newLine, kind });
      }
    }

    if (!line.startsWith("-")) {
      newLine += 1;
    }
  }

  return secrets;
}

function matchingKinds(content: string, allowlist: RegExp[]): string[] {
  return detectedFormats
    .filter(({ pattern }) =>
      [...content.matchAll(pattern)].some(([match]) => !isAllowlisted(match, allowlist))
    )
    .map(({ kind }) => kind);
}
