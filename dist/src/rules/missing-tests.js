import { minimatch } from "minimatch";
export const missingTestsRule = {
    id: "missing-tests",
    description: "Flags source changes that do not include matching test changes.",
    run({ files, config }) {
        const ruleConfig = config.rules.missingTests;
        if (!ruleConfig.enabled) {
            return [];
        }
        const hasSourceChange = files.some((file) => ruleConfig.sourceGlobs.some((glob) => minimatch(file.path, glob)));
        const hasTestChange = files.some((file) => ruleConfig.testGlobs.some((glob) => minimatch(file.path, glob)));
        if (!hasSourceChange || hasTestChange) {
            return [];
        }
        return [
            {
                ruleId: "missing-tests",
                title: "Source changed without tests",
                severity: "warning",
                message: "Source files changed, but no test files were modified in this pull request.",
                recommendation: "Add or update tests for the modified behavior, or explain why existing coverage is sufficient."
            }
        ];
    }
};
