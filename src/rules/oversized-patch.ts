import type { Rule } from "../analysis/rule.js";

export const oversizedPatchRule: Rule = {
  id: "oversized-patch",
  description: "Reports files whose patch was too large to inspect.",
  run({ files }) {
    return files
      .filter((file) => file.patchOmitted)
      .map((file) => ({
        ruleId: "oversized-patch",
        title: "Patch too large to inspect",
        severity: "info" as const,
        file: file.path,
        message: "This file's patch exceeds the configured size limit, so its content was not inspected.",
        recommendation: "Review this file manually or split the change into smaller pull requests."
      }));
  }
};
