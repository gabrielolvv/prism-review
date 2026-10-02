import type { Rule } from "../analysis/rule.js";

const maxListedLines = 5;

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
  if (lines.length === 1 && kinds.length === 1) {
    return `Line ${lines[0]} adds what looks like ${article(kinds[0] ?? "")} ${kinds[0]}. The value is redacted from this review.`;
  }

  const listed = lines.slice(0, maxListedLines).join(", ");
  const more = lines.length > maxListedLines ? ` and ${lines.length - maxListedLines} more` : "";
  const subject = lines.length === 1 ? "Line" : "Lines";
  const verb = lines.length === 1 ? "adds" : "add";
  return `${subject} ${listed}${more} ${verb} values that look like credentials (${kinds.join(", ")}). The values are redacted from this review.`;
}

function article(kind: string): string {
  return /^[AEIOU]/i.test(kind) ? "an" : "a";
}
