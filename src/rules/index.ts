import { blanketSuppressionRule } from "./blanket-suppression.js";
import { configChangeRule } from "./config-change.js";
import { credentialFileRule } from "./credential-file.js";
import { dependencyRiskRule } from "./dependency-risk.js";
import { destructiveMigrationRule } from "./destructive-migration.js";
import { disabledSecurityCheckRule } from "./disabled-security-check.js";
import { hiddenUnicodeRule } from "./hidden-unicode.js";
import { incompleteReviewRule } from "./incomplete-review.js";
import { largeDiffRule } from "./large-diff.js";
import { lockfileSourceRule } from "./lockfile-source.js";
import { missingTestsRule } from "./missing-tests.js";
import { oversizedPatchRule } from "./oversized-patch.js";
import { privilegedContainerRule } from "./privileged-container.js";
import { publicExposureRule } from "./public-exposure.js";
import { remoteScriptRule } from "./remote-script.js";
import { riskyApiRule } from "./risky-api.js";
import { secretInDiffRule } from "./secret-in-diff.js";
import { sensitiveFilesRule } from "./sensitive-files.js";
import { unpinnedActionRule } from "./unpinned-action.js";
import { workflowRiskRule } from "./workflow-risk.js";
import { skippedTestsRule } from "./skipped-tests.js";
import { sqlInjectionRule } from "./sql-injection.js";
import type { Rule } from "../analysis/rule.js";

export const defaultRules: Rule[] = [
  incompleteReviewRule,
  secretInDiffRule,
  credentialFileRule,
  disabledSecurityCheckRule,
  hiddenUnicodeRule,
  largeDiffRule,
  missingTestsRule,
  skippedTestsRule,
  blanketSuppressionRule,
  riskyApiRule,
  sqlInjectionRule,
  remoteScriptRule,
  workflowRiskRule,
  unpinnedActionRule,
  destructiveMigrationRule,
  privilegedContainerRule,
  publicExposureRule,
  sensitiveFilesRule,
  configChangeRule,
  lockfileSourceRule,
  dependencyRiskRule,
  oversizedPatchRule
];
