import { minimatch } from "minimatch";
import type { Rule } from "../analysis/rule.js";

const sensitiveWords = [
  "auth",
  "permission",
  "role",
  "session",
  "token",
  "jwt",
  "billing",
  "payment",
  "secret",
  "migration",
  "workflow",
  "dockerfile"
];

// Words that contain a sensitive word without being about it: author (but not authorize),
// tokenize, parole, secretary. Everything else that contains one, such as "Unauthorized",
// "reauth", "jwtauth", or "accesstoken", still counts.
const unrelatedWord = /^(?:co)?author(?!i[sz])|tokeni[sz]|parole|secretar/;

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
          // A pattern without a slash matches the file name in any directory, as in .gitignore.
          ruleConfig.patterns.some((pattern) => minimatch(file.path, pattern, { matchBase: true })) ||
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
  return pathWords(path).some(
    (word) => !unrelatedWord.test(word) && sensitiveWords.some((sensitive) => word.includes(sensitive))
  );
}

// Splits on separators and camelCase: "src/AuthorList.ts" -> src, author, list, ts.
function pathWords(path: string): string[] {
  return path
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
