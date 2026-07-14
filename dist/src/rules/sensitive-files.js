import { minimatch } from "minimatch";
const sensitiveKeywordPattern = /(auth|authorization|permission|role|session|token|jwt|oauth|billing|payment|secret|migration|workflow|dockerfile)/i;
export const sensitiveFilesRule = {
    id: "sensitive-files",
    description: "Flags changes to files that often require careful human review.",
    run({ files, config }) {
        const ruleConfig = config.rules.sensitiveFiles;
        if (!ruleConfig.enabled) {
            return [];
        }
        return files
            .filter((file) => ruleConfig.patterns.some((pattern) => minimatch(file.path, pattern)) ||
            sensitiveKeywordPattern.test(file.path))
            .map((file) => ({
            ruleId: "sensitive-files",
            title: "Sensitive file changed",
            severity: "high",
            file: file.path,
            message: `${file.path} touches an area that commonly affects security, deployment, data integrity, or access control.`,
            recommendation: "Ask for focused review from someone familiar with this area and verify rollback or mitigation steps."
        }));
    }
};
