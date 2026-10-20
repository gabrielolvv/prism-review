import type { Rule } from "../analysis/rule.js";

// GitHub lists at most 3000 files for a pull request. Files beyond that are never reviewed, so a
// gate must not pass the pull request as if they were.
export const incompleteReviewRule: Rule = {
  id: "incomplete-review",
  description: "Flags pull requests with more changed files than GitHub returned for review.",
  seesIgnoredFiles: true,
  run({ files, expectedFileCount }) {
    if (expectedFileCount === undefined || expectedFileCount <= files.length) {
      return [];
    }

    return [
      {
        ruleId: "incomplete-review",
        title: "Pull request too large to review fully",
        severity: "high",
        message: `This pull request changes ${expectedFileCount} files, but GitHub returned ${files.length}, so ${expectedFileCount - files.length} files were not reviewed.`,
        recommendation:
          "Split the pull request, or review the remaining files another way, for example with the CLI on the full git diff."
      }
    ];
  }
};
