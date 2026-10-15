import { addedLines } from "../analysis/added-lines.js";
import type { ChangedFile, SecretMatch } from "../analysis/changed-file.js";
import { credentialFormats, isAllowlisted } from "./credential-formats.js";

// A private key header is not secret itself, but the key material follows it.
const detectedFormats = [
  ...credentialFormats,
  { kind: "private key", pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g }
];

// Runs before redaction, which would otherwise hide the values it looks for.
export function detectSecrets(files: ChangedFile[], allowlist: RegExp[] = []): ChangedFile[] {
  return files.map((file) => {
    const secrets = file.patch === undefined ? [] : findAddedSecrets(file.patch, allowlist);
    return secrets.length === 0 ? { ...file } : { ...file, secrets };
  });
}

// Only added lines count: a removed line takes a secret out, and a context line was already there.
export function findAddedSecrets(patch: string, allowlist: RegExp[] = []): SecretMatch[] {
  return addedLines(patch).flatMap(({ line, content }) =>
    matchingKinds(content, allowlist).map((kind) => ({ line, kind }))
  );
}

function matchingKinds(content: string, allowlist: RegExp[]): string[] {
  return detectedFormats
    .filter(({ pattern }) =>
      [...content.matchAll(pattern)].some(([match]) => !isAllowlisted(match, allowlist))
    )
    .map(({ kind }) => kind);
}
