import { dependencyRiskRule } from "./dependency-risk.js";
import { largeDiffRule } from "./large-diff.js";
import { missingTestsRule } from "./missing-tests.js";
import { sensitiveFilesRule } from "./sensitive-files.js";
export const defaultRules = [
    largeDiffRule,
    missingTestsRule,
    sensitiveFilesRule,
    dependencyRiskRule
];
