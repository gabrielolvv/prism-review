import { normalizeRepositoryPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";

export const configChangeRule: Rule = {
  id: "config-change",
  seesIgnoredFiles: true,
  description: "Flags pull requests that change the Prism Review configuration or a file it extends.",
  run({ files, configPath, extendedConfigPaths = [] }) {
    const target = normalizeRepositoryPath(configPath);
    const extended = new Set(extendedConfigPaths.map(normalizeRepositoryPath));
    const matches = (file: (typeof files)[number], paths: ReadonlySet<string>) =>
      [file.path, file.previousPath].some((path) => path !== undefined && paths.has(normalizeRepositoryPath(path)));

    return files
      .filter((file) => matches(file, new Set([target])) || matches(file, extended))
      .map((file) => ({
        ruleId: "config-change",
        title: "Review configuration changed",
        severity: "high" as const,
        file: file.path,
        message: matches(file, new Set([target]))
          ? "This file is the Prism Review configuration, which controls how pull requests are reviewed."
          : "The Prism Review configuration extends this file, which controls how pull requests are reviewed.",
        recommendation:
          "Confirm that thresholds, rule patterns, and redaction allowlist entries were not relaxed to hide findings."
      }));
  }
};
