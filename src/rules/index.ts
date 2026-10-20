import { blanketSuppressionRule } from "./blanket-suppression.js";
import { configChangeRule } from "./config-change.js";
import { dependencyRiskRule } from "./dependency-risk.js";
import { hiddenUnicodeRule } from "./hidden-unicode.js";
import { largeDiffRule } from "./large-diff.js";
import { missingTestsRule } from "./missing-tests.js";
import { oversizedPatchRule } from "./oversized-patch.js";
import { riskyApiRule } from "./risky-api.js";
import { secretInDiffRule } from "./secret-in-diff.js";
import { sensitiveFilesRule } from "./sensitive-files.js";
import { skippedTestsRule } from "./skipped-tests.js";
import type { Rule } from "../analysis/rule.js";

export const defaultRules: Rule[] = [
  secretInDiffRule,
  hiddenUnicodeRule,
  largeDiffRule,
  missingTestsRule,
  skippedTestsRule,
  blanketSuppressionRule,
  riskyApiRule,
  sensitiveFilesRule,
  configChangeRule,
  dependencyRiskRule,
  oversizedPatchRule
];
