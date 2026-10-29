import { minimatch } from "minimatch";
import { isTestDataPath } from "../analysis/repository-path.js";
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
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const sensitiveFilesRule: Rule = {
  id: "sensitive-files",
  description: "Flags changes to files that often require careful human review.",
  run({ files, config }) {
    const ruleConfig = config.rules.sensitiveFiles;
    if (!ruleConfig.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;
    // Tests, documentation, and fixtures describe an area without changing how it behaves.
    const describesOnly = (path: string) =>
      documentation.test(path) || isTestDataPath(path) || testGlobs.some((glob) => minimatch(path, glob));

    return files.flatMap((file) => {
      // A pattern without a slash matches the file name in any directory, as in .gitignore.
      if (ruleConfig.patterns.some((pattern) => minimatch(file.path, pattern, { matchBase: true }))) {
        return [finding(file.path, "high", "This file touches an area that commonly affects security, deployment, data integrity, or access control.")];
      }
      // A word in the path is a weaker signal than a pattern the repository chose.
      if (hasSensitiveWord(file.path) && !describesOnly(file.path)) {
        return [finding(file.path, "warning", "This file's path names an area that commonly affects security, deployment, data integrity, or access control.")];
      }
      return [];
    });
  }
};

function finding(file: string, severity: "high" | "warning", message: string) {
  return {
    ruleId: "sensitive-files",
    title: "Sensitive file changed",
    severity,
    file,
    message,
    recommendation: "Ask for focused review from someone familiar with this area and verify rollback or mitigation steps."
  };
}

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
