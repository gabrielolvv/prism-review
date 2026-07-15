import type { ChangedFile } from "../analysis/changed-file.js";

const redaction = "[REDACTED]";

const assignmentPatterns = [
  /\b(api[_-]?key|token|secret|password|passwd|pwd|client[_-]?secret)\b\s*[:=]\s*["']?[^"',\s]+/gi,
  /\b(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY)\b\s*[:=]\s*["']?[^"',\s]+/g
];

const standaloneSecretPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
];

export function redactSecrets(value: string): string {
  let redacted = value;

  for (const pattern of assignmentPatterns) {
    redacted = redacted.replace(pattern, (match) => {
      const separatorIndex = findSeparatorIndex(match);
      if (separatorIndex === -1) {
        return redaction;
      }

      return `${match.slice(0, separatorIndex + 1)} ${redaction}`;
    });
  }

  for (const pattern of standaloneSecretPatterns) {
    redacted = redacted.replace(pattern, redaction);
  }

  return redacted;
}

export function redactChangedFiles(files: ChangedFile[]): ChangedFile[] {
  return files.map((file) => ({
    ...file,
    patch: file.patch ? redactSecrets(file.patch) : file.patch
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
