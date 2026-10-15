import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

export const secretInDiffRule: Rule = {
  id: "secret-in-diff",
  description: "Flags added lines that contain a value in a known credential format.",
  run({ files, config }) {
    if (!config.rules.secretInDiff.enabled) {
      return [];
    }

    return files
      .filter((file) => file.secrets !== undefined && file.secrets.length > 0)
      .map((file) => {
        const secrets = file.secrets ?? [];
        const lines = [...new Set(secrets.map((secret) => secret.line))].sort((a, b) => a - b);
        const kinds = [...new Set(secrets.map((secret) => secret.kind))];

        return {
          ruleId: "secret-in-diff",
          title: "Possible secret added",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          message: describe(lines, kinds),
          recommendation:
            "Treat the credential as exposed: revoke or rotate it, remove it from the branch history, and load it from a secret store. If it is a known test value, add a pattern for it to security.redaction.allowlist."
        };
      });
  }
};

function describe(lines: number[], kinds: string[]): string {
  const { text, plural } = describeLines(lines);
  if (!plural && kinds.length === 1) {
    return `${text} adds what looks like ${article(kinds[0] ?? "")} ${kinds[0]}. The value is redacted from this review.`;
  }

  return `${text} ${plural ? "add" : "adds"} values that look like credentials (${kinds.join(", ")}). The values are redacted from this review.`;
}

function article(kind: string): string {
  return /^[AEIOU]/i.test(kind) ? "an" : "a";
}
