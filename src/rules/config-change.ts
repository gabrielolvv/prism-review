import { normalizeRepositoryPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";

export const configChangeRule: Rule = {
  id: "config-change",
  description: "Flags pull requests that change the Prism Review configuration.",
  run({ files, configPath }) {
    const target = normalizeRepositoryPath(configPath);

    return files
      .filter((file) =>
        [file.path, file.previousPath].some(
          (path) => path !== undefined && normalizeRepositoryPath(path) === target
        )
      )
      .map((file) => ({
        ruleId: "config-change",
        title: "Review configuration changed",
        severity: "high" as const,
        file: file.path,
        message: `${file.path} changes the Prism Review configuration, which controls how pull requests are reviewed.`,
        recommendation:
          "Confirm that thresholds, rule patterns, and redaction allowlist entries were not relaxed to hide findings."
      }));
  }
};
