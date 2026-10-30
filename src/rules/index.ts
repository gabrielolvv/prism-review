import { blanketSuppressionRule } from "./blanket-suppression.js";
import { configChangeRule } from "./config-change.js";
import { reviewControlChangeRule } from "./review-control-change.js";
import { credentialFileRule } from "./credential-file.js";
import { hardcodedJwtSecretRule } from "./hardcoded-jwt-secret.js";
import { secretLoggingRule } from "./secret-logging.js";
import { urlCredentialsRule } from "./url-credentials.js";
import { unescapedHtmlRule } from "./unescaped-html.js";
import { timingUnsafeComparisonRule } from "./timing-unsafe-comparison.js";
import { postMessageOriginRule } from "./postmessage-origin.js";
import { nosqlInjectionRule } from "./nosql-injection.js";
import { dependencyRiskRule } from "./dependency-risk.js";
import { destructiveMigrationRule } from "./destructive-migration.js";
import { disabledSecurityCheckRule } from "./disabled-security-check.js";
import { hiddenUnicodeRule } from "./hidden-unicode.js";
import { incompleteReviewRule } from "./incomplete-review.js";
import { largeDiffRule } from "./large-diff.js";
import { lockfileSourceRule } from "./lockfile-source.js";
import { lookalikeDependencyRule } from "./lookalike-dependency.js";
import { riskyDependencyVersionRule } from "./risky-dependency-version.js";
import { staleLockfileRule } from "./stale-lockfile.js";
import { missingTestsRule } from "./missing-tests.js";
import { oversizedPatchRule } from "./oversized-patch.js";
import { privilegedContainerRule } from "./privileged-container.js";
import { dockerfileRiskRule } from "./dockerfile-risk.js";
import { insecureInfrastructureRule } from "./insecure-infrastructure.js";
import { kubernetesRbacRule } from "./kubernetes-rbac.js";
import { filePermissionsRule } from "./file-permissions.js";
import { insecureWebConfigRule } from "./insecure-web-config.js";
import { weakCryptoRule } from "./weak-crypto.js";
import { xmlExternalEntitiesRule } from "./xml-external-entities.js";
import { massAssignmentRule } from "./mass-assignment.js";
import { redosRule } from "./redos.js";
import { untrustedInputRule } from "./untrusted-input.js";
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
  hardcodedJwtSecretRule,
  secretLoggingRule,
  urlCredentialsRule,
  disabledSecurityCheckRule,
  hiddenUnicodeRule,
  largeDiffRule,
  missingTestsRule,
  skippedTestsRule,
  blanketSuppressionRule,
  riskyApiRule,
  unescapedHtmlRule,
  timingUnsafeComparisonRule,
  postMessageOriginRule,
  nosqlInjectionRule,
  sqlInjectionRule,
  insecureWebConfigRule,
  weakCryptoRule,
  untrustedInputRule,
  xmlExternalEntitiesRule,
  massAssignmentRule,
  redosRule,
  remoteScriptRule,
  workflowRiskRule,
  unpinnedActionRule,
  destructiveMigrationRule,
  privilegedContainerRule,
  dockerfileRiskRule,
  publicExposureRule,
  insecureInfrastructureRule,
  kubernetesRbacRule,
  filePermissionsRule,
  sensitiveFilesRule,
  configChangeRule,
  reviewControlChangeRule,
  lockfileSourceRule,
  lookalikeDependencyRule,
  riskyDependencyVersionRule,
  staleLockfileRule,
  dependencyRiskRule,
  oversizedPatchRule
];
