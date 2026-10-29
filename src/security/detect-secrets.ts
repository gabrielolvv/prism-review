import { addedLines } from "../analysis/added-lines.js";
import type { ChangedFile, SecretMatch } from "../analysis/changed-file.js";
import { credentialFormats, isAllowlisted } from "./credential-formats.js";

// A private key header is not secret itself, but the key material follows it.
const privateKeyHeader = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g;
const detectedFormats = [...credentialFormats, { kind: "private key", pattern: privateKeyHeader }];
// Base64 key material, on the header's line, as in "-----BEGIN ... KEY-----\nMIIE...", or on one of the
// next lines, after headers such as `Proc-Type: 4,ENCRYPTED` in encrypted keys or `Version:` in PGP.
// A header alone, such as a constant a TLS library uses to write keys, holds no key.
const keyMaterial = /[A-Za-z0-9+/]{40,}/;
const materialWindow = 6;
// AWS's documentation uses AKIAIOSFODNN7EXAMPLE, and SDKs and their tests copy it.
const documentedExample = /^AKIA[0-9A-Z]{9}EXAMPLE$/;

// Runs before redaction, which would otherwise hide the values it looks for. Every file gets a
// `secrets` array, so the rule can tell "scanned, nothing found" from "never scanned".
export function detectSecrets(files: ChangedFile[], allowlist: RegExp[] = []): ChangedFile[] {
  return files.map((file) => ({
    ...file,
    secrets: file.patch === undefined ? [] : findAddedSecrets(file.patch, allowlist)
  }));
}

// Only added lines count: a removed line takes a secret out, and a context line was already there.
export function findAddedSecrets(patch: string, allowlist: RegExp[] = []): SecretMatch[] {
  const lines = addedLines(patch);
  return lines.flatMap(({ line, content }, index) =>
    matchingKinds(content, allowlist)
      .filter((kind) => kind !== "private key" || hasKeyMaterial(lines, index))
      .map((kind) => ({ line, kind }))
  );
}

function matchingKinds(content: string, allowlist: RegExp[]): string[] {
  return detectedFormats
    .filter(({ pattern }) =>
      [...content.matchAll(pattern)].some(([match]) => !isAllowlisted(match, allowlist) && !documentedExample.test(match))
    )
    .map(({ kind }) => kind);
}

function hasKeyMaterial(lines: Array<{ line: number; content: string }>, index: number): boolean {
  const header = lines[index];
  if (header === undefined) {
    return false;
  }
  const afterHeader = header.content.slice(header.content.lastIndexOf("-----") + 5);
  if (keyMaterial.test(afterHeader)) {
    return true;
  }
  return lines
    .slice(index + 1, index + 1 + materialWindow)
    .some(({ line, content }) => line - header.line <= materialWindow && keyMaterial.test(content));
}
