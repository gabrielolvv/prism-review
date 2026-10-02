import type { ChangedFile } from "../analysis/changed-file.js";
import { credentialFormats, isAllowlisted } from "./credential-formats.js";

const redaction = "[REDACTED]";

const assignmentPatterns = [
  /\b(api[_-]?key|token|secret|password|passwd|pwd|client[_-]?secret)\b\s*[:=]\s*["']?[^"',\s]+/gi,
  /\b(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY)\b\s*[:=]\s*["']?[^"',\s]+/g
];

const standaloneSecretPatterns = [
  ...credentialFormats.map((format) => format.pattern),
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
];

export type RedactionOptions = {
  allowlist?: RegExp[];
};

export function redactSecrets(value: string, options: RedactionOptions = {}): string {
  const allowlist = options.allowlist ?? [];
  let redacted = value;

  for (const pattern of assignmentPatterns) {
    redacted = redacted.replace(pattern, (match) => {
      const separatorIndex = findSeparatorIndex(match);
      if (separatorIndex === -1) {
        return redaction;
      }

      const assigned = match.slice(separatorIndex + 1).trim().replace(/^["']/, "");
      if (isAllowlisted(assigned, allowlist)) {
        return match;
      }

      return `${match.slice(0, separatorIndex + 1)} ${redaction}`;
    });
  }

  for (const pattern of standaloneSecretPatterns) {
    redacted = redacted.replace(pattern, (match) =>
      isAllowlisted(match, allowlist) ? match : redaction
    );
  }

  return redacted;
}

export function redactChangedFiles(
  files: ChangedFile[],
  options: RedactionOptions = {}
): ChangedFile[] {
  return files.map((file) => ({
    ...file,
    patch: file.patch ? redactSecrets(file.patch, options) : file.patch
  }));
}

function findSeparatorIndex(value: string): number {
  const equalsIndex = value.indexOf("=");
  const colonIndex = value.indexOf(":");

  if (equalsIndex === -1) {
    return colonIndex;
  }

  if (colonIndex === -1) {
    return equalsIndex;
  }

  return Math.min(equalsIndex, colonIndex);
}
