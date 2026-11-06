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
import { templateInjectionRule } from "./template-injection.js";
import { prototypePollutionRule } from "./prototype-pollution.js";
import { ldapXpathInjectionRule } from "./ldap-xpath-injection.js";
import { uploadFilenameRule } from "./upload-filename.js";
import { reflectedXssRule } from "./reflected-xss.js";
import { logInjectionRule } from "./log-injection.js";
import { staticIvRule } from "./static-iv.js";
import { plaintextPasswordRule } from "./plaintext-password.js";
import { adminRouteAuthRule } from "./admin-route-auth.js";
import { zipSlipRule } from "./zip-slip.js";
import { regexInjectionRule } from "./regex-injection.js";
import { electronSecurityRule } from "./electron-security.js";
import { unsafeReflectionRule } from "./unsafe-reflection.js";
import { commandInjectionRule } from "./command-injection.js";
import { weakPasswordHashingRule } from "./weak-password-hashing.js";
import { hardcodedSessionSecretRule } from "./hardcoded-session-secret.js";
import { jwtWithoutExpiryRule } from "./jwt-without-expiry.js";
import { weakTlsRule } from "./weak-tls.js";
import { securityHeadersRule } from "./security-headers.js";
import { debugEndpointRule } from "./debug-endpoint.js";
import { mobileSecurityRule } from "./mobile-security.js";
import { insecureTempFileRule } from "./insecure-temp-file.js";
import { publicEnvSecretRule } from "./public-env-secret.js";
import { hostHeaderRule } from "./host-header.js";
import { unsafeHtmlConfigRule } from "./unsafe-html-config.js";
import { websocketOriginRule } from "./websocket-origin.js";
import { weakPasswordPolicyRule } from "./weak-password-policy.js";
import { requestSizeLimitRule } from "./request-size-limit.js";
import { tokenStorageRule } from "./token-storage.js";
import { longSessionRule } from "./long-session.js";
import { openAccessRule } from "./open-access.js";
import { bruteForceProtectionRule } from "./brute-force-protection.js";
import { sshHostKeyRule } from "./ssh-host-key.js";
import { grpcPlaintextRule } from "./grpc-plaintext.js";
import { serviceAuthDisabledRule } from "./service-auth-disabled.js";
import { errorDetailsRule } from "./error-details.js";
import { subresourceIntegrityRule } from "./subresource-integrity.js";
import { directoryListingRule } from "./directory-listing.js";
import { weakKeySizeRule } from "./weak-key-size.js";
import { spoofableClientIpRule } from "./spoofable-client-ip.js";
import { hardcodedCryptoKeyRule } from "./hardcoded-crypto-key.js";
import { databaseTlsDisabledRule } from "./database-tls-disabled.js";
import { plaintextCredentialsRule } from "./plaintext-credentials.js";
import { weakOauthFlowRule } from "./weak-oauth-flow.js";
import { staticRootExposureRule } from "./static-root-exposure.js";
import { hostPathMountRule } from "./host-path-mount.js";
import { insecurePackageSourceRule } from "./insecure-package-source.js";
import { unauthenticatedFunctionRule } from "./unauthenticated-function.js";
import { devConsoleExposedRule } from "./dev-console-exposed.js";
import { sshServerConfigRule } from "./ssh-server-config.js";
import { unconfinedContainerRule } from "./unconfined-container.js";
import { meshMtlsDisabledRule } from "./mesh-mtls-disabled.js";
import { opsToolAuthRule } from "./ops-tool-auth.js";
import { publicClusterApiRule } from "./public-cluster-api.js";
import { brokerPlaintextAuthRule } from "./broker-plaintext-auth.js";
import { publicResourcePolicyRule } from "./public-resource-policy.js";
import { plainHttpEndpointRule } from "./plain-http-endpoint.js";
import { unpinnedDeployImageRule } from "./unpinned-deploy-image.js";
import { samlValidationDisabledRule } from "./saml-validation-disabled.js";
import { polymorphicDeserializationRule } from "./polymorphic-deserialization.js";
import { ciScriptInjectionRule } from "./ci-script-injection.js";
import { iamPrivilegeEscalationRule } from "./iam-privilege-escalation.js";
import { sessionIdInUrlRule } from "./session-id-in-url.js";
import { llmCodeExecutionRule } from "./llm-code-execution.js";
import { untrustedModelCodeRule } from "./untrusted-model-code.js";
import { kubernetesSecretValuesRule } from "./kubernetes-secret-values.js";
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
  templateInjectionRule,
  prototypePollutionRule,
  ldapXpathInjectionRule,
  uploadFilenameRule,
  reflectedXssRule,
  logInjectionRule,
  staticIvRule,
  plaintextPasswordRule,
  adminRouteAuthRule,
  zipSlipRule,
  regexInjectionRule,
  electronSecurityRule,
  unsafeReflectionRule,
  commandInjectionRule,
  weakPasswordHashingRule,
  hardcodedSessionSecretRule,
  jwtWithoutExpiryRule,
  weakTlsRule,
  securityHeadersRule,
  debugEndpointRule,
  mobileSecurityRule,
  insecureTempFileRule,
  publicEnvSecretRule,
  hostHeaderRule,
  unsafeHtmlConfigRule,
  websocketOriginRule,
  weakPasswordPolicyRule,
  requestSizeLimitRule,
  tokenStorageRule,
  longSessionRule,
  openAccessRule,
  bruteForceProtectionRule,
  sshHostKeyRule,
  grpcPlaintextRule,
  serviceAuthDisabledRule,
  errorDetailsRule,
  subresourceIntegrityRule,
  directoryListingRule,
  weakKeySizeRule,
  spoofableClientIpRule,
  hardcodedCryptoKeyRule,
  databaseTlsDisabledRule,
  plaintextCredentialsRule,
  weakOauthFlowRule,
  staticRootExposureRule,
  hostPathMountRule,
  insecurePackageSourceRule,
  unauthenticatedFunctionRule,
  devConsoleExposedRule,
  sshServerConfigRule,
  unconfinedContainerRule,
  meshMtlsDisabledRule,
  opsToolAuthRule,
  publicClusterApiRule,
  brokerPlaintextAuthRule,
  publicResourcePolicyRule,
  plainHttpEndpointRule,
  unpinnedDeployImageRule,
  samlValidationDisabledRule,
  polymorphicDeserializationRule,
  ciScriptInjectionRule,
  iamPrivilegeEscalationRule,
  sessionIdInUrlRule,
  llmCodeExecutionRule,
  untrustedModelCodeRule,
  kubernetesSecretValuesRule,
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
