import { minimatch } from "minimatch";
import type { Rule } from "../analysis/rule.js";

// Matched against whole words of the path, so "authoring", "tokenizer", and "parole" do not count.
const sensitiveWordPatterns = [
  // auth, authn, authz, oauth2, authenticate, authentication, authorize, authorization.
  /^o?auth(?:[nz]|enticat\w*|ori[sz]\w*)?\d*$/,
  /^(?:permissions?|roles?|sessions?|tokens?|jwts?|billing|payments?|secrets?|migrations?|workflows?|dockerfile)$/
];

export const sensitiveFilesRule: Rule = {
  id: "sensitive-files",
  description: "Flags changes to files that often require careful human review.",
  run({ files, config }) {
    const ruleConfig = config.rules.sensitiveFiles;
    if (!ruleConfig.enabled) {
      return [];
    }

    return files
      .filter(
        (file) =>
          ruleConfig.patterns.some((pattern) => minimatch(file.path, pattern)) ||
          hasSensitiveWord(file.path)
      )
      .map((file) => ({
        ruleId: "sensitive-files",
        title: "Sensitive file changed",
        severity: "high" as const,
        file: file.path,
        message: "This file touches an area that commonly affects security, deployment, data integrity, or access control.",
        recommendation:
          "Ask for focused review from someone familiar with this area and verify rollback or mitigation steps."
      }));
  }
};

function hasSensitiveWord(path: string): boolean {
  return pathWords(path).some((word) => sensitiveWordPatterns.some((pattern) => pattern.test(word)));
}

// Splits on separators and camelCase: "src/oauthClient.ts" -> src, oauth, client, ts.
function pathWords(path: string): string[] {
  return path
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
