// Token formats specific enough that a match is very likely a real credential.
// The redactor masks them, and the secret-in-diff rule reports them.
export const credentialFormats: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "AWS access key ID", pattern: /\bAKIA[0-9A-Z]{16}\b/g }
];

export function isAllowlisted(candidate: string, allowlist: RegExp[]): boolean {
  return allowlist.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(candidate);
  });
}
