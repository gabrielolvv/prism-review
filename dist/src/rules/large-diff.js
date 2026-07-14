import { changedLines } from "../analysis/changed-file.js";
export const largeDiffRule = {
    id: "large-diff",
    description: "Flags pull requests that exceed configured file or line thresholds.",
    run({ files, config }) {
        const maxFiles = config.risk.largeDiff.maxFiles;
        const maxChangedLines = config.risk.largeDiff.maxChangedLines;
        const totalChangedLines = files.reduce((total, file) => total + changedLines(file), 0);
        if (files.length <= maxFiles && totalChangedLines <= maxChangedLines) {
            return [];
        }
        return [
            {
                ruleId: "large-diff",
                title: "Large pull request",
                severity: "warning",
                message: `This PR changes ${files.length} file(s) and ${totalChangedLines} line(s), which exceeds the configured review threshold.`,
                recommendation: "Consider splitting the change or adding a clear reviewer guide that explains the intended review order."
            }
        ];
    }
};
