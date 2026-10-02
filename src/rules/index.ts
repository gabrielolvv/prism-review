import { configChangeRule } from "./config-change.js";
import { dependencyRiskRule } from "./dependency-risk.js";
import { largeDiffRule } from "./large-diff.js";
import { missingTestsRule } from "./missing-tests.js";
import { oversizedPatchRule } from "./oversized-patch.js";
import { secretInDiffRule } from "./secret-in-diff.js";
import { sensitiveFilesRule } from "./sensitive-files.js";
import type { Rule } from "../analysis/rule.js";

export const defaultRules: Rule[] = [
  secretInDiffRule,
  largeDiffRule,
  missingTestsRule,
  sensitiveFilesRule,
  configChangeRule,
  dependencyRiskRule,
  oversizedPatchRule
];
