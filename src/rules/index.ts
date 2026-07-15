import { dependencyRiskRule } from "./dependency-risk.js";
import { largeDiffRule } from "./large-diff.js";
import { missingTestsRule } from "./missing-tests.js";
import { sensitiveFilesRule } from "./sensitive-files.js";
import type { Rule } from "../analysis/rule.js";

export const defaultRules: Rule[] = [
  largeDiffRule,
  missingTestsRule,
  sensitiveFilesRule,
  dependencyRiskRule
];
