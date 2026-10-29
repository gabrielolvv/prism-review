import {
  testWeakCryptoReadsOtherLanguages,
  testWeakCryptoReportsEachKind,
  testWeakCryptoSkipsSafeUses
} from "./unit/weak-crypto.test.js";
import {
  testInsecureWebConfigReportsCookiesAndDebug,
  testInsecureWebConfigReportsCorsWithCredentials,
  testInsecureWebConfigSkipsSafeSettings
} from "./unit/insecure-web-config.test.js";
import {
  testFilePermissionsReportsCodeCalls,
  testFilePermissionsReportsShellAndDocker,
  testFilePermissionsSkipsSafeModes
} from "./unit/file-permissions.test.js";
import {
  testKubernetesRbacReportsClusterWideGrants,
  testKubernetesRbacReportsWildcardsAndEscalation,
  testKubernetesRbacSkipsNarrowRolesAndOtherFiles
} from "./unit/kubernetes-rbac.test.js";
import {
  testInsecureInfrastructureReportsTemplatesAndPolicies,
  testInsecureInfrastructureReportsTerraform,
  testInsecureInfrastructureSkipsSafeSettings
} from "./unit/insecure-infrastructure.test.js";
import {
  testDockerfileRiskOnlyReadsDockerfiles,
  testDockerfileRiskReadsContinuedLinesAndContext,
  testDockerfileRiskReportsEachKind,
  testDockerfileRiskSkipsSafeInstructions
} from "./unit/dockerfile-risk.test.js";
import {
  testScopedNpmPackagesAreDependencyChanges,
  testScopedNpmPackagesGoThroughTheDependencyRules
} from "./unit/scoped-packages.test.js";
import {
  testAiSummaryCannotChangeTheReview,
  testAiSummaryIsOffByDefault,
  testAnthropicProviderAsksForStructuredOutput,
  testAnthropicProviderRejectsRefusalsAndCutOffReplies,
  testFailedSummaryIsReportedInsteadOfThrown,
  testSummaryReplyIsValidatedAndGrounded,
  testSummaryRequestSendsOnlyTheRedactedReviewedDiff,
  testSummaryRequestStaysWithinTheCharacterBudget
} from "./unit/ai-summary.test.js";
import {
  testPaginateFollowsPagesUntilShortBatch,
  testPaginateStopsAtPageLimit,
  testRequestFailsWithStatus,
  testRequestReturnsUndefinedForNoContent,
  testRequestSendsAuthenticatedJson,
  testRequestTruncatesErrorDetails,
  testRequestUsesConfiguredApiUrl,
  testRequestUsesTimeoutSignal,
  testResolveGitHubApiUrlDefaultsToGitHubCom,
  testResolveGitHubApiUrlNormalizesEnterpriseUrls,
  testResolveGitHubApiUrlRejectsInvalidValues
} from "./unit/github-client.test.js";
import {
  testRiskyApiRuleCoversRubyJavaAndPhp,
  testRiskyApiRuleIgnoresRubyJavaAndPhpLookalikes,
  testBlanketSuppressionRuleCoversRubyJavaAndPhp,
  testBlanketSuppressionRuleIgnoresTargetedRubyJavaAndPhp,
  testSkippedTestsRuleCoversRubyJavaAndPhp,
  testSkippedTestsRuleKeepsMarkersInTheirLanguage
} from "./unit/more-languages.test.js";
import {
  testLineRulesCoverCSharp,
  testLineRulesCoverSwift,
  testLineRulesIgnoreCSharpAndSwiftLookalikes
} from "./unit/csharp-swift.test.js";
import {
  testHiddenUnicodeRuleReportsBidiControlsAsHigh,
  testHiddenUnicodeRuleReportsInvisibleCharactersAsWarning,
  testHiddenUnicodeRuleIgnoresLegitimateCharacters,
  testHiddenUnicodeRuleReportsByteOrderMarkInsideAFile,
  testHiddenUnicodeRuleChecksPathsAndRendersThemSafely,
  testHiddenUnicodeRuleIgnoresRemovedLinesAndCanBeDisabled,
  testPromptInjectionFixtureDoesNotChangeTheReview
} from "./unit/hidden-unicode.test.js";
import {
  testParseUnifiedDiffDecodesQuotedPaths,
  testParseUnifiedDiffHandlesPrefixSettings,
  testParseUnifiedDiffRejectsUnrecognizedHeaders,
  testHiddenUnicodeRuleScansOversizedPatches,
  testHiddenUnicodeRuleReportsInvisibleIdentifiers,
  testBlanketSuppressionRuleReportsPhpcsIgnoreFile,
  testRiskyApiRuleReadsRubyEvalAndShellForms,
  testSkippedTestsRuleTellsPestFromLaravel,
  testSkippedTestsRuleReadsCombinedCSharpAttributes
} from "./unit/review-findings-060.test.js";
import {
  testIgnorePathsSkipsNoiseRules,
  testIgnorePathsNeverHidesSecurityFindings,
  testIgnorePathsDefaultsToReviewingEverything
} from "./unit/ignore-paths.test.js";
import {
  testSeverityOverridesChangeFindingsAndRisk,
  testSeverityOverrideOffRemovesARule,
  testSeverityOverridesRejectUnknownRules
} from "./unit/severity-overrides.test.js";
import {
  testLargeDiffOffAlsoSkipsTheSizeCheck,
  testIgnorePathsMatchDotfilesAndRenames,
  testRuleIdListMatchesTheRegisteredRules,
  testRenderMarkdownCapsTheCommentLength
} from "./unit/review-findings-070.test.js";
import {
  testIncompleteReviewRuleReportsMissingFiles,
  testIncompleteReviewRuleIsQuietWhenEveryFileArrived,
  testIncompleteReviewRuleIgnoresAStaleCountBelowGitHubsLimit
} from "./unit/incomplete-review.test.js";
import {
  testWorkflowRiskRuleReportsScriptInjectionAsHigh,
  testWorkflowRiskRuleReportsRiskyTriggersAndPermissions,
  testWorkflowRiskRuleIgnoresSafePatterns,
  testWorkflowRiskRuleChecksCompositeActionsAndCanBeDisabled,
  testWorkflowRiskReportsNewWorkflowsWithoutPermissions,
  testWorkflowRiskReportsTopLevelWritePermissions
} from "./unit/workflow-risk.test.js";
import {
  testWorkflowRiskRuleTreatsEveryMappingValueAsData,
  testWorkflowRiskRuleReadsScriptBlocks,
  testWorkflowRiskRuleReadsScriptBlocksThatStartBeforeTheHunk,
  testWorkflowRiskRuleSeesThroughBracketsFormatAndToJson,
  testWorkflowRiskRuleIgnoresIgnorePaths,
  testWorkflowRiskRuleReportsTriggersOnly
} from "./unit/workflow-risk-review.test.js";
import {
  testDestructiveMigrationRuleReportsEachFramework,
  testDestructiveMigrationRuleIgnoresRollbackSections,
  testDestructiveMigrationRuleUsesTheHunkHeaderForContext,
  testDestructiveMigrationRuleIgnoresSafeChangesAndOtherFiles,
  testDestructiveMigrationRuleCanBeDisabled,
  testDestructiveMigrationRuleReadsMySqlDropsAndCodeAfterARollback,
  testDestructiveMigrationRuleSkipsSqlComments
} from "./unit/destructive-migration.test.js";
import {
  testCredentialFileRuleReportsFilesThatHoldCredentials,
  testCredentialFileRuleReportsSecretsInEnvironmentFiles,
  testCredentialFileRuleReportsPackageManagerTokens,
  testCredentialFileRuleIgnoresExamplesTestsAndPublicFiles,
  testCredentialFileRuleSkipsDeletionsAndSeesIgnoredPaths,
  testCredentialFileRuleReadsValuesBeforeRedaction,
  testCredentialFileRuleCanBeDisabled
} from "./unit/credential-file.test.js";
import {
  testLockfileSourceRuleReportsEachEcosystem,
  testLockfileSourceRuleReadsEverySupportedFile,
  testLockfileSourceRuleAllowsRegistriesAndLocalPackages,
  testLockfileSourceRuleTellsGemfileGitSectionsApart,
  testLockfileSourceRuleUsesAllowedSources,
  testLockfileSourceRuleReadsPatchesBeforeTheSizeLimitAndRedaction,
  testLockfileSourceRuleCanBeDisabled,
  testLockfileSourceRuleSeesIgnoredLockfiles,
  testLockfileSourceRuleReadsOlderAndNewerFormats,
  testLockfileSourceRuleReadsPyprojectSources
} from "./unit/lockfile-source.test.js";
import {
  testRemoteScriptRuleReportsDownloadedScriptsThatRun,
  testRemoteScriptRuleIgnoresDownloadsThatDoNotRun,
  testRemoteScriptRuleCanBeDisabled,
  testRemoteScriptRuleJoinsContinuedLines
} from "./unit/remote-script.test.js";
import {
  testUnpinnedActionRuleReportsTagsBranchesAndImages,
  testUnpinnedActionRuleSkipsCommentsOtherFilesAndAllowedOwners,
  testUnpinnedActionRuleSeesIgnoredFilesAndCanBeDisabled
} from "./unit/unpinned-action.test.js";
import {
  testPrivilegedContainerRuleReportsHostAccess,
  testPrivilegedContainerRuleIgnoresHardenedAndUnrelatedSettings,
  testPrivilegedContainerRuleCanBeDisabled
} from "./unit/privileged-container.test.js";
import {
  testPublicExposureRuleReportsOpenPortsAndPublicStorage,
  testPublicExposureRuleAllowsPublicWebAndPrivateRanges,
  testPublicExposureRuleCanBeDisabled
} from "./unit/public-exposure.test.js";
import {
  testDisabledSecurityCheckRuleReportsEachLanguage,
  testDisabledSecurityCheckRuleIgnoresSafeCodeDocsAndTests,
  testDisabledSecurityCheckRuleCanBeDisabled
} from "./unit/disabled-security-check.test.js";
import {
  testSqlInjectionRuleReportsSqlBuiltFromValues,
  testSqlInjectionRuleIgnoresParameterizedQueries,
  testSqlInjectionRuleCanBeDisabled
} from "./unit/sql-injection.test.js";
import {
  testInlineSuppressionMovesAcknowledgedFindingsOut,
  testInlineSuppressionNeedsEveryLineARuleAndAReason,
  testInlineSuppressionCannotHideSecurityRules,
  testInlineSuppressionIsListedInTheComment,
  testInlineSuppressionSharesTheCommentSizeLimit
} from "./unit/inline-suppression.test.js";
import {
  testRenderJsonKeepsEveryField,
  testRenderSarifMapsFindingsForCodeScanning
} from "./unit/output-formats.test.js";
import {
  testEveryRuleHasAnArea,
  testRenderMarkdownGroupsFindingsByArea,
  testRenderMarkdownListsOneAreaWithoutGroups,
  testRenderMarkdownCountsFindingsLeftOutOfGroups
} from "./unit/finding-areas.test.js";
import {
  testReviewStateRoundTripsAndIgnoresLineNumbers,
  testReviewStateKeepsFileNamesOut,
  testReviewStateRejectsAnythingMalformed,
  testReviewStateGivesUpPastItsLimit,
  testRenderMarkdownMarksNewFindings,
  testRenderMarkdownLeavesRoomForTheRecord
} from "./unit/review-state.test.js";
import {
  testEveryRuleHasAChecklistQuestion,
  testChecklistAsksAboutTheFindings,
  testChecklistFallsBackToGeneralQuestions,
  testChecklistAddsTheRepositoryQuestions,
  testChecklistSharesTheCommentSizeLimit
} from "./unit/checklist.test.js";
import {
  testCodeOwnersFollowGitHubPatterns,
  testCodeOwnersSkipLinesGitHubCannotRead,
  testRenderMarkdownNamesOwnersWithoutMentioningThem
} from "./unit/code-owners.test.js";
import { testGeneratedFilesAreLeftOutOfNoiseRulesOnly, testGitAttributesFollowGitRules } from "./unit/git-attributes.test.js";
import {
  testReviewControlChangeCannotBeHidden,
  testReviewControlChangeReportsCodeOwners,
  testReviewControlChangeReportsGeneratedMarkers
} from "./unit/review-control-change.test.js";
import {
  testLookalikeDependencyRuleReportsTyposquats,
  testLookalikeDependencyRuleSkipsKnownAndUnrelatedNames,
  testOneEditApart
} from "./unit/lookalike-dependency.test.js";
import {
  testDependencyChangesAcrossManifests,
  testDependencyChangesAreListedInTheReview,
  testDependencyChangesShareTheCommentSizeLimit
} from "./unit/dependency-changes.test.js";
import {
  testRiskyDependencyVersionLeavesBoundedChangesAlone,
  testRiskyDependencyVersionReportsOlderAndOpenVersions
} from "./unit/risky-dependency-version.test.js";
import {
  testFindLockfilesListsOnlyTheDirectoriesItNeeds,
  testStaleLockfileAcceptsUpdatedOrMissingLockfiles,
  testStaleLockfileReportsManifestsWithoutTheirLockfile
} from "./unit/stale-lockfile.test.js";
import { testGoModulesAreReadFromGoMod, testGoModulesGoThroughTheDependencyRules } from "./unit/go-modules.test.js";
import {
  testComposerAndNuGetGoThroughTheDependencyRules,
  testComposerAndNuGetManifestsAreRead
} from "./unit/composer-nuget.test.js";
import {
  testGradleDependenciesAreRead,
  testMavenAndGradleGoThroughTheDependencyRules,
  testMavenDependenciesAreReadAcrossLines
} from "./unit/maven-gradle.test.js";
import { testRulePatternsStayLinearOnLongLines } from "./unit/pattern-performance.test.js";
import {
  testPathOverridesChangeSeverityForMatchingFiles,
  testPathOverridesRejectUnknownRulesAndEmptyPaths
} from "./unit/path-overrides.test.js";
import {
  testEncodedPromptInjectionDoesNotChangeTheReview,
  testTagCharacterInstructionsAreReportedAndNotEchoed
} from "./unit/prompt-injection.test.js";
import {
  testPlanLineCommentsCreatesUpdatesAndResolves,
  testPlanLineCommentsKeepsResolvedCommentsQuietAndCapsTheCount,
  testRenderLineCommentEscapesFindingText
} from "./unit/line-comments.test.js";
import {
  testConfigurationDocsNameEveryRule,
  testEveryRuleLinksToItsDocumentation,
  testReadmeListsEveryRule
} from "./unit/docs.test.js";
import {
  testRiskyApiRuleCanBeDisabled,
  testRiskyApiRuleCoversAliasesAndShellForms,
  testRiskyApiRuleIgnoresDefinitionsAndSafeLoaders,
  testRiskyApiRuleIgnoresLookalikes,
  testRiskyApiRuleReportsASingleCall,
  testRiskyApiRuleReportsEachLanguage,
  testRiskyApiRuleSkipsTestsDocsAndRemovedLines
} from "./unit/risky-api.test.js";
import {
  testConfigNeverFailsByDefault,
  testDescribeFailureNamesThreshold,
  testFailingFindingsFollowsThreshold
} from "./unit/check-outcome.test.js";
import {
  testConfigChangeRuleFlagsDefaultConfig,
  testConfigChangeRuleFlagsRenamedConfig,
  testConfigChangeRuleUsesConfiguredPath
} from "./unit/config-change.test.js";
import {
  testFetchRepositoryFileDecodesContent,
  testFetchRepositoryFilePropagatesOtherErrors,
  testFetchRepositoryFileRejectsDirectories,
  testFetchRepositoryFileRejectsSymlinksAndSubmodules,
  testFetchRepositoryFileRejectsUnreadableContent,
  testFetchRepositoryFileReturnsUndefinedWhenMissing
} from "./unit/fetch-repository-file.test.js";
import { testFetchPullRequestFilesNormalizesResponse } from "./unit/fetch-pull-request.test.js";
import {
  testReadInputsDefaultsConfigPath,
  testReadInputsNormalizesConfigPath,
  testReadInputsReadsRunnerVariableNames,
  testReadInputsRejectsPathsOutsideRepository
} from "./unit/inputs.test.js";
import {
  testLoadBaseBranchConfigNamesBaseCommitInErrors,
  testLoadBaseBranchConfigParsesBaseFile,
  testLoadBaseBranchConfigReturnsUndefinedWhenMissing
} from "./unit/load-base-config.test.js";
import {
  testParseConfigAppliesDefaults,
  testParseConfigLabelsRootErrors,
  testParseConfigReportsSourceAndField,
  testParseConfigReportsYamlErrors,
  testParseConfigFillsNestedDefaults,
  testParseConfigTreatsEmptyFileAsDefaults
} from "./unit/load-config.test.js";
import {
  testLimitPatchSizesCountsBytes,
  testLimitPatchSizesOmitsOversizedPatches,
  testOversizedPatchRuleReportsOmittedPatches
} from "./unit/limit-patches.test.js";
import {
  testParseUnifiedDiff,
  testParseUnifiedDiffReadsRenameSourceFromRenameLine,
  testParseUnifiedDiffRecordsRenameSource
} from "./unit/parse-unified-diff.test.js";
import { testPrepareChangedFilesLimitsThenRedacts } from "./unit/prepare-changed-files.test.js";
import {
  testAppendModeAlwaysCreatesComment,
  testUpsertCreatesCommentWhenMarkerIsMissing,
  testUpsertIgnoresBotCommentsWithoutLeadingMarker,
  testUpsertIgnoresMarkerInHumanComments,
  testUpsertModeUpdatesExistingComment,
  testUpsertUpdatesExistingComment,
  testUpsertUpdatesMostRecentMarkerComment
} from "./unit/publish-comment.test.js";
import {
  testAllowlistDoesNotShieldOtherSecrets,
  testConfigRejectsInvalidAllowlistPattern,
  testPrepareChangedFilesAppliesAllowlist,
  testRedactChangedFilesDoesNotMutateOriginal,
  testRedactSecrets,
  testRedactSecretsKeepsAllowlistedAssignments,
  testRedactSecretsKeepsAllowlistedValues
} from "./unit/redact-secrets.test.js";
import {
  testConfigDisablesAnnotationsByDefault,
  testRenderAnnotationsEscapesPullRequestContent,
  testRenderAnnotationsHidesInfoByDefault,
  testRenderAnnotationsIncludesLineAndRecommendation,
  testRenderAnnotationsMapsSeverityToCommands,
  testRenderAnnotationsSkipsFindingsWithoutFile
} from "./unit/render-annotations.test.js";
import {
  testRenderMarkdown,
  testRenderMarkdownEscapesFindingText,
  testRenderMarkdownFencesBackticksInPaths,
  testRenderMarkdownHidesLowSeverityByDefault,
  testRenderMarkdownKeepsHostilePathsInert,
  testRenderMarkdownIncludesLowSeverityWhenEnabled
} from "./unit/render-markdown.test.js";
import {
  testBlanketSuppressionRuleCanBeDisabled,
  testBlanketSuppressionRuleChecksMarkersInTheirLanguage,
  testBlanketSuppressionRuleIgnoresRemovedLines,
  testBlanketSuppressionRuleIgnoresTargetedSuppressions,
  testBlanketSuppressionRuleReportsEachLanguage
} from "./unit/blanket-suppression.test.js";
import {
  testDefaultRules,
  testDependencyRiskRule,
  testSensitiveFilesRuleMatchesKeywordsAsWords,
  testSensitiveFilePatternsStayHighForEveryFile,
  testPatternsWithoutASlashMatchAtAnyDepth
} from "./unit/rules.test.js";
import {
  testFindAddedSecretsDetectsPgpPrivateKeys,
  testFindAddedSecretsHonorsAllowlist,
  testFindAddedSecretsIgnoresGenericTokens,
  testFindAddedSecretsNumbersLinesInTheNewFile,
  testFindAddedSecretsSkipsGitHeaders,
  testFindAddedSecretsStaysLinearOnHostileInput,
  testSecretInDiffRuleCanBeDisabled,
  testSecretInDiffRuleReportsFixtureLeak,
  testSecretInDiffRuleScansOversizedPatches,
  testSecretInDiffRuleScansUnpreparedFiles,
  testSecretInDiffRuleSummarizesManyLines
} from "./unit/secret-in-diff.test.js";
import {
  testSkippedTestsRuleCanBeDisabled,
  testSkippedTestsRuleCoversOtherLanguagesByDefault,
  testSkippedTestsRuleIgnoresLookalikes,
  testSkippedTestsRuleIgnoresRemovedLinesAndNonTestFiles,
  testSkippedTestsRuleReportsFocusAndSkipWithLines
} from "./unit/skipped-tests.test.js";

type Test = () => void | Promise<void>;

const tests: Array<[string, Test]> = [
  ["parseUnifiedDiff parses changed files", testParseUnifiedDiff],
  ["default rules flag sensitive files and missing tests", testDefaultRules],
  ["dependency risk rule flags manifest and lockfile changes", testDependencyRiskRule],
  ["sensitive files rule matches keywords as whole words", testSensitiveFilesRuleMatchesKeywordsAsWords],
  ["sensitive-files patterns stay high for every file", testSensitiveFilePatternsStayHighForEveryFile],
  ["redactSecrets masks token-like values", testRedactSecrets],
  ["findAddedSecrets numbers lines in the new file", testFindAddedSecretsNumbersLinesInTheNewFile],
  ["findAddedSecrets skips git headers", testFindAddedSecretsSkipsGitHeaders],
  ["findAddedSecrets honors the redaction allowlist", testFindAddedSecretsHonorsAllowlist],
  ["findAddedSecrets ignores generic long tokens", testFindAddedSecretsIgnoresGenericTokens],
  ["secret-in-diff rule reports the fixture leak on its line", testSecretInDiffRuleReportsFixtureLeak],
  ["secret-in-diff rule summarizes many lines", testSecretInDiffRuleSummarizesManyLines],
  ["secret-in-diff rule can be disabled", testSecretInDiffRuleCanBeDisabled],
  ["findAddedSecrets detects PGP private keys", testFindAddedSecretsDetectsPgpPrivateKeys],
  ["secret-in-diff rule scans patches over the size limit", testSecretInDiffRuleScansOversizedPatches],
  ["secret-in-diff rule scans files that were not prepared", testSecretInDiffRuleScansUnpreparedFiles],
  ["findAddedSecrets stays linear on hostile input", testFindAddedSecretsStaysLinearOnHostileInput],
  ["skipped-tests rule reports focused and skipped tests with lines", testSkippedTestsRuleReportsFocusAndSkipWithLines],
  ["skipped-tests rule ignores removed lines and non-test files", testSkippedTestsRuleIgnoresRemovedLinesAndNonTestFiles],
  ["skipped-tests rule ignores lookalike calls", testSkippedTestsRuleIgnoresLookalikes],
  ["skipped-tests rule covers Python, Go, and Rust with the default config", testSkippedTestsRuleCoversOtherLanguagesByDefault],
  ["skipped-tests rule can be disabled", testSkippedTestsRuleCanBeDisabled],
  ["blanket-suppression rule reports blanket suppressions in each language", testBlanketSuppressionRuleReportsEachLanguage],
  ["blanket-suppression rule ignores targeted suppressions", testBlanketSuppressionRuleIgnoresTargetedSuppressions],
  ["blanket-suppression rule ignores removed lines", testBlanketSuppressionRuleIgnoresRemovedLines],
  ["blanket-suppression rule can be disabled", testBlanketSuppressionRuleCanBeDisabled],
  ["blanket-suppression rule checks markers in their own language", testBlanketSuppressionRuleChecksMarkersInTheirLanguage],
  ["risky-api rule covers Ruby, Java, and PHP", testRiskyApiRuleCoversRubyJavaAndPhp],
  ["risky-api rule ignores Ruby, Java, and PHP lookalikes", testRiskyApiRuleIgnoresRubyJavaAndPhpLookalikes],
  ["blanket-suppression rule covers Ruby, Java, and PHP", testBlanketSuppressionRuleCoversRubyJavaAndPhp],
  ["blanket-suppression rule ignores targeted Ruby, Java, and PHP suppressions", testBlanketSuppressionRuleIgnoresTargetedRubyJavaAndPhp],
  ["skipped-tests rule covers Ruby, Java, and PHP", testSkippedTestsRuleCoversRubyJavaAndPhp],
  ["skipped-tests rule keeps markers in their own language", testSkippedTestsRuleKeepsMarkersInTheirLanguage],
  ["line rules cover C#", testLineRulesCoverCSharp],
  ["line rules cover Swift", testLineRulesCoverSwift],
  ["line rules ignore C# and Swift lookalikes", testLineRulesIgnoreCSharpAndSwiftLookalikes],
  ["hidden-unicode rule reports bidirectional controls as high", testHiddenUnicodeRuleReportsBidiControlsAsHigh],
  ["hidden-unicode rule reports invisible characters as warnings", testHiddenUnicodeRuleReportsInvisibleCharactersAsWarning],
  ["hidden-unicode rule ignores legitimate characters", testHiddenUnicodeRuleIgnoresLegitimateCharacters],
  ["hidden-unicode rule reports a byte order mark inside a file", testHiddenUnicodeRuleReportsByteOrderMarkInsideAFile],
  ["hidden-unicode rule checks paths and renders them safely", testHiddenUnicodeRuleChecksPathsAndRendersThemSafely],
  ["hidden-unicode rule ignores removed lines and can be disabled", testHiddenUnicodeRuleIgnoresRemovedLinesAndCanBeDisabled],
  ["prompt injection in a diff does not change the review", testPromptInjectionFixtureDoesNotChangeTheReview],
  ["parse unified diff decodes quoted paths", testParseUnifiedDiffDecodesQuotedPaths],
  ["parse unified diff handles prefix settings", testParseUnifiedDiffHandlesPrefixSettings],
  ["parse unified diff rejects unrecognized headers", testParseUnifiedDiffRejectsUnrecognizedHeaders],
  ["hidden unicode rule scans oversized patches", testHiddenUnicodeRuleScansOversizedPatches],
  ["hidden unicode rule reports invisible identifiers", testHiddenUnicodeRuleReportsInvisibleIdentifiers],
  ["blanket suppression rule reports phpcs ignore file", testBlanketSuppressionRuleReportsPhpcsIgnoreFile],
  ["risky api rule reads ruby eval and shell forms", testRiskyApiRuleReadsRubyEvalAndShellForms],
  ["skipped tests rule tells pest from laravel", testSkippedTestsRuleTellsPestFromLaravel],
  ["skipped tests rule reads combined c sharp attributes", testSkippedTestsRuleReadsCombinedCSharpAttributes],
  ["ignorePaths keeps ignored files out of the noise rules", testIgnorePathsSkipsNoiseRules],
  ["ignorePaths never hides security findings", testIgnorePathsNeverHidesSecurityFindings],
  ["ignorePaths defaults to reviewing every file", testIgnorePathsDefaultsToReviewingEverything],
  ["severity overrides change findings and the risk level", testSeverityOverridesChangeFindingsAndRisk],
  ["a severity override of off removes a rule's findings", testSeverityOverrideOffRemovesARule],
  ["severity overrides reject unknown rules and severities", testSeverityOverridesRejectUnknownRules],
  ["large diff off also skips the size check", testLargeDiffOffAlsoSkipsTheSizeCheck],
  ["ignore paths match dotfiles and renames", testIgnorePathsMatchDotfilesAndRenames],
  ["rule id list matches the registered rules", testRuleIdListMatchesTheRegisteredRules],
  ["render markdown caps the comment length", testRenderMarkdownCapsTheCommentLength],
  ["incomplete-review rule reports files GitHub did not return", testIncompleteReviewRuleReportsMissingFiles],
  ["incomplete-review rule is quiet when every file arrived", testIncompleteReviewRuleIsQuietWhenEveryFileArrived],
  ["incomplete-review rule ignores a stale count below GitHub's limit", testIncompleteReviewRuleIgnoresAStaleCountBelowGitHubsLimit],
  ["workflow risk rule reports script injection as high", testWorkflowRiskRuleReportsScriptInjectionAsHigh],
  ["workflow risk rule reports risky triggers and permissions", testWorkflowRiskRuleReportsRiskyTriggersAndPermissions],
  ["workflow risk rule ignores safe patterns", testWorkflowRiskRuleIgnoresSafePatterns],
  ["workflow risk rule checks composite actions and can be disabled", testWorkflowRiskRuleChecksCompositeActionsAndCanBeDisabled],
  ["workflow risk rule treats every mapping value as data", testWorkflowRiskRuleTreatsEveryMappingValueAsData],
  ["workflow risk rule reads script blocks", testWorkflowRiskRuleReadsScriptBlocks],
  ["workflow risk rule reads script blocks that start before the hunk", testWorkflowRiskRuleReadsScriptBlocksThatStartBeforeTheHunk],
  ["workflow risk rule sees through brackets format and to json", testWorkflowRiskRuleSeesThroughBracketsFormatAndToJson],
  ["workflow risk rule ignores ignore paths", testWorkflowRiskRuleIgnoresIgnorePaths],
  ["workflow risk rule reports triggers only", testWorkflowRiskRuleReportsTriggersOnly],
  ["destructive-migration rule reports each framework", testDestructiveMigrationRuleReportsEachFramework],
  ["destructive-migration rule ignores rollback sections", testDestructiveMigrationRuleIgnoresRollbackSections],
  ["destructive-migration rule uses the hunk header for context", testDestructiveMigrationRuleUsesTheHunkHeaderForContext],
  ["destructive-migration rule ignores safe changes and other files", testDestructiveMigrationRuleIgnoresSafeChangesAndOtherFiles],
  ["destructive-migration rule can be disabled", testDestructiveMigrationRuleCanBeDisabled],
  ["destructive-migration rule reads MySQL drops and code after a rollback", testDestructiveMigrationRuleReadsMySqlDropsAndCodeAfterARollback],
  ["destructive-migration rule skips SQL comments", testDestructiveMigrationRuleSkipsSqlComments],
  ["credential-file rule reports files that hold credentials", testCredentialFileRuleReportsFilesThatHoldCredentials],
  ["credential-file rule reports secrets in environment files", testCredentialFileRuleReportsSecretsInEnvironmentFiles],
  ["credential-file rule reports package manager tokens", testCredentialFileRuleReportsPackageManagerTokens],
  ["credential-file rule ignores examples, tests, and public files", testCredentialFileRuleIgnoresExamplesTestsAndPublicFiles],
  ["credential-file rule skips deletions and sees ignored paths", testCredentialFileRuleSkipsDeletionsAndSeesIgnoredPaths],
  ["credential-file rule reads values before redaction", testCredentialFileRuleReadsValuesBeforeRedaction],
  ["credential-file rule can be disabled", testCredentialFileRuleCanBeDisabled],
  ["lockfile-source rule reports each ecosystem", testLockfileSourceRuleReportsEachEcosystem],
  ["lockfile-source rule reads every supported file", testLockfileSourceRuleReadsEverySupportedFile],
  ["lockfile-source rule allows registries and local packages", testLockfileSourceRuleAllowsRegistriesAndLocalPackages],
  ["lockfile-source rule tells Gemfile Git sections apart", testLockfileSourceRuleTellsGemfileGitSectionsApart],
  ["lockfile-source rule uses allowed sources", testLockfileSourceRuleUsesAllowedSources],
  ["lockfile-source rule reads patches before the size limit and redaction", testLockfileSourceRuleReadsPatchesBeforeTheSizeLimitAndRedaction],
  ["lockfile-source rule can be disabled", testLockfileSourceRuleCanBeDisabled],
  ["lockfile-source rule sees ignored lockfiles", testLockfileSourceRuleSeesIgnoredLockfiles],
  ["lockfile-source rule reads older and newer formats", testLockfileSourceRuleReadsOlderAndNewerFormats],
  ["lockfile-source rule reads pyproject sources", testLockfileSourceRuleReadsPyprojectSources],
  ["patterns without a slash match at any depth", testPatternsWithoutASlashMatchAtAnyDepth],
  ["remote-script rule reports downloaded scripts that run", testRemoteScriptRuleReportsDownloadedScriptsThatRun],
  ["remote-script rule ignores downloads that do not run", testRemoteScriptRuleIgnoresDownloadsThatDoNotRun],
  ["remote-script rule can be disabled", testRemoteScriptRuleCanBeDisabled],
  ["remote-script rule joins continued lines", testRemoteScriptRuleJoinsContinuedLines],
  ["unpinned-action rule reports tags, branches, and images", testUnpinnedActionRuleReportsTagsBranchesAndImages],
  ["unpinned-action rule skips comments, other files, and allowed owners", testUnpinnedActionRuleSkipsCommentsOtherFilesAndAllowedOwners],
  ["unpinned-action rule sees ignored files and can be disabled", testUnpinnedActionRuleSeesIgnoredFilesAndCanBeDisabled],
  ["privileged-container rule reports host access", testPrivilegedContainerRuleReportsHostAccess],
  ["privileged-container rule ignores hardened and unrelated settings", testPrivilegedContainerRuleIgnoresHardenedAndUnrelatedSettings],
  ["privileged-container rule can be disabled", testPrivilegedContainerRuleCanBeDisabled],
  ["public-exposure rule reports open ports and public storage", testPublicExposureRuleReportsOpenPortsAndPublicStorage],
  ["public-exposure rule allows public web and private ranges", testPublicExposureRuleAllowsPublicWebAndPrivateRanges],
  ["public-exposure rule can be disabled", testPublicExposureRuleCanBeDisabled],
  ["disabled-security-check rule reports each language", testDisabledSecurityCheckRuleReportsEachLanguage],
  ["disabled-security-check rule ignores safe code, docs, and tests", testDisabledSecurityCheckRuleIgnoresSafeCodeDocsAndTests],
  ["disabled-security-check rule can be disabled", testDisabledSecurityCheckRuleCanBeDisabled],
  ["sql-injection rule reports SQL built from values", testSqlInjectionRuleReportsSqlBuiltFromValues],
  ["sql-injection rule ignores parameterized queries", testSqlInjectionRuleIgnoresParameterizedQueries],
  ["sql-injection rule can be disabled", testSqlInjectionRuleCanBeDisabled],
  ["inline suppression moves acknowledged findings out", testInlineSuppressionMovesAcknowledgedFindingsOut],
  ["inline suppression needs every line, a rule, and a reason", testInlineSuppressionNeedsEveryLineARuleAndAReason],
  ["inline suppression cannot hide security rules", testInlineSuppressionCannotHideSecurityRules],
  ["inline suppression is listed in the comment", testInlineSuppressionIsListedInTheComment],
  ["inline suppression shares the comment size limit", testInlineSuppressionSharesTheCommentSizeLimit],
  ["render JSON keeps every field", testRenderJsonKeepsEveryField],
  ["render SARIF maps findings for code scanning", testRenderSarifMapsFindingsForCodeScanning],
  ["every rule has an area", testEveryRuleHasAnArea],
  ["render markdown groups findings by area", testRenderMarkdownGroupsFindingsByArea],
  ["render markdown lists one area without groups", testRenderMarkdownListsOneAreaWithoutGroups],
  ["render markdown counts findings left out of groups", testRenderMarkdownCountsFindingsLeftOutOfGroups],
  ["review state round-trips and ignores line numbers", testReviewStateRoundTripsAndIgnoresLineNumbers],
  ["review state keeps file names out", testReviewStateKeepsFileNamesOut],
  ["review state rejects anything malformed", testReviewStateRejectsAnythingMalformed],
  ["review state gives up past its limit", testReviewStateGivesUpPastItsLimit],
  ["render markdown marks new findings", testRenderMarkdownMarksNewFindings],
  ["render markdown leaves room for the review state", testRenderMarkdownLeavesRoomForTheRecord],
  ["every rule has a checklist question", testEveryRuleHasAChecklistQuestion],
  ["checklist asks about the findings", testChecklistAsksAboutTheFindings],
  ["checklist falls back to general questions", testChecklistFallsBackToGeneralQuestions],
  ["checklist adds the repository's questions", testChecklistAddsTheRepositoryQuestions],
  ["checklist shares the comment size limit", testChecklistSharesTheCommentSizeLimit],
  ["code owners follow GitHub's patterns", testCodeOwnersFollowGitHubPatterns],
  ["code owners skip lines GitHub cannot read", testCodeOwnersSkipLinesGitHubCannotRead],
  ["render markdown names owners without mentioning them", testRenderMarkdownNamesOwnersWithoutMentioningThem],
  ["gitattributes follow git's rules", testGitAttributesFollowGitRules],
  ["generated files are left out of noise rules only", testGeneratedFilesAreLeftOutOfNoiseRulesOnly],
  ["review control change reports code owners", testReviewControlChangeReportsCodeOwners],
  ["review control change reports generated markers", testReviewControlChangeReportsGeneratedMarkers],
  ["review control change cannot be hidden", testReviewControlChangeCannotBeHidden],
  ["lookalike dependency rule reports typosquats", testLookalikeDependencyRuleReportsTyposquats],
  ["lookalike dependency rule skips known and unrelated names", testLookalikeDependencyRuleSkipsKnownAndUnrelatedNames],
  ["names one edit apart", testOneEditApart],
  ["dependency changes across manifests", testDependencyChangesAcrossManifests],
  ["dependency changes are listed in the review", testDependencyChangesAreListedInTheReview],
  ["dependency changes share the comment size limit", testDependencyChangesShareTheCommentSizeLimit],
  ["risky dependency version reports older and open versions", testRiskyDependencyVersionReportsOlderAndOpenVersions],
  ["risky dependency version leaves bounded changes alone", testRiskyDependencyVersionLeavesBoundedChangesAlone],
  ["stale lockfile reports manifests without their lockfile", testStaleLockfileReportsManifestsWithoutTheirLockfile],
  ["stale lockfile accepts updated or missing lockfiles", testStaleLockfileAcceptsUpdatedOrMissingLockfiles],
  ["findLockfiles lists only the directories it needs", testFindLockfilesListsOnlyTheDirectoriesItNeeds],
  ["Go modules are read from go.mod", testGoModulesAreReadFromGoMod],
  ["Go modules go through the dependency rules", testGoModulesGoThroughTheDependencyRules],
  ["Composer and NuGet manifests are read", testComposerAndNuGetManifestsAreRead],
  ["Composer and NuGet go through the dependency rules", testComposerAndNuGetGoThroughTheDependencyRules],
  ["Maven dependencies are read across lines", testMavenDependenciesAreReadAcrossLines],
  ["Gradle dependencies are read", testGradleDependenciesAreRead],
  ["Maven and Gradle go through the dependency rules", testMavenAndGradleGoThroughTheDependencyRules],
  ["workflow-risk reports write permissions for every job", testWorkflowRiskReportsTopLevelWritePermissions],
  ["workflow-risk reports new workflows that set no permissions", testWorkflowRiskReportsNewWorkflowsWithoutPermissions],
  ["weak-crypto reports each kind", testWeakCryptoReportsEachKind],
  ["weak-crypto reads other languages", testWeakCryptoReadsOtherLanguages],
  ["weak-crypto skips safe uses", testWeakCryptoSkipsSafeUses],
  ["insecure-web-config reports CORS with credentials", testInsecureWebConfigReportsCorsWithCredentials],
  ["insecure-web-config reports cookies and debug modes", testInsecureWebConfigReportsCookiesAndDebug],
  ["insecure-web-config skips safe settings", testInsecureWebConfigSkipsSafeSettings],
  ["file-permissions reports shell and Docker modes", testFilePermissionsReportsShellAndDocker],
  ["file-permissions reports chmod and umask calls in code", testFilePermissionsReportsCodeCalls],
  ["file-permissions skips safe modes and other files", testFilePermissionsSkipsSafeModes],
  ["kubernetes-rbac reports cluster-wide grants", testKubernetesRbacReportsClusterWideGrants],
  ["kubernetes-rbac reports wildcards and escalation verbs", testKubernetesRbacReportsWildcardsAndEscalation],
  ["kubernetes-rbac skips narrow roles and other files", testKubernetesRbacSkipsNarrowRolesAndOtherFiles],
  ["insecure-infrastructure reports Terraform settings", testInsecureInfrastructureReportsTerraform],
  ["insecure-infrastructure reports templates and policy documents", testInsecureInfrastructureReportsTemplatesAndPolicies],
  ["insecure-infrastructure skips safe settings", testInsecureInfrastructureSkipsSafeSettings],
  ["dockerfile-risk reports each kind of risk", testDockerfileRiskReportsEachKind],
  ["dockerfile-risk skips safe instructions", testDockerfileRiskSkipsSafeInstructions],
  ["dockerfile-risk reads continued lines and context", testDockerfileRiskReadsContinuedLinesAndContext],
  ["dockerfile-risk only reads Dockerfiles", testDockerfileRiskOnlyReadsDockerfiles],
  ["scoped npm packages are dependency changes", testScopedNpmPackagesAreDependencyChanges],
  ["scoped npm packages go through the dependency rules", testScopedNpmPackagesGoThroughTheDependencyRules],
  ["the AI summary is off by default", testAiSummaryIsOffByDefault],
  ["the AI summary request sends only the redacted reviewed diff", testSummaryRequestSendsOnlyTheRedactedReviewedDiff],
  ["the AI summary request stays within the character budget", testSummaryRequestStaysWithinTheCharacterBudget],
  ["the AI summary reply is validated and grounded in the diff", testSummaryReplyIsValidatedAndGrounded],
  ["a failed AI summary is reported instead of thrown", testFailedSummaryIsReportedInsteadOfThrown],
  ["the Anthropic provider asks for structured output", testAnthropicProviderAsksForStructuredOutput],
  ["the Anthropic provider rejects refusals and cut-off replies", testAnthropicProviderRejectsRefusalsAndCutOffReplies],
  ["the AI summary cannot change the review", testAiSummaryCannotChangeTheReview],
  ["rule patterns stay linear on long lines", testRulePatternsStayLinearOnLongLines],
  ["path overrides change severity for matching files", testPathOverridesChangeSeverityForMatchingFiles],
  ["path overrides reject unknown rules and empty paths", testPathOverridesRejectUnknownRulesAndEmptyPaths],
  ["encoded prompt injection does not change the review", testEncodedPromptInjectionDoesNotChangeTheReview],
  ["tag character instructions are reported and not echoed", testTagCharacterInstructionsAreReportedAndNotEchoed],
  ["plan line comments creates, updates, and resolves", testPlanLineCommentsCreatesUpdatesAndResolves],
  ["plan line comments keeps resolved comments quiet and caps the count", testPlanLineCommentsKeepsResolvedCommentsQuietAndCapsTheCount],
  ["render line comment escapes finding text", testRenderLineCommentEscapesFindingText],
  ["README lists every rule", testReadmeListsEveryRule],
  ["configuration docs name every rule", testConfigurationDocsNameEveryRule],
  ["every rule links to its documentation", testEveryRuleLinksToItsDocumentation],
  ["risky-api rule reports risky calls in each language", testRiskyApiRuleReportsEachLanguage],
  ["risky-api rule reports a single call", testRiskyApiRuleReportsASingleCall],
  ["risky-api rule ignores lookalike calls", testRiskyApiRuleIgnoresLookalikes],
  ["risky-api rule skips tests, docs, and removed lines", testRiskyApiRuleSkipsTestsDocsAndRemovedLines],
  ["risky-api rule can be disabled", testRiskyApiRuleCanBeDisabled],
  ["risky-api rule covers aliases and common shell forms", testRiskyApiRuleCoversAliasesAndShellForms],
  ["risky-api rule ignores definitions and safe loaders", testRiskyApiRuleIgnoresDefinitionsAndSafeLoaders],
  ["failingFindings follows the check.failOn threshold", testFailingFindingsFollowsThreshold],
  ["describeFailure names the threshold", testDescribeFailureNamesThreshold],
  ["config never fails the check by default", testConfigNeverFailsByDefault],
  ["redactChangedFiles does not mutate original files", testRedactChangedFilesDoesNotMutateOriginal],
  ["renderMarkdown renders stable review sections", testRenderMarkdown],
  ["renderMarkdown hides info findings by default", testRenderMarkdownHidesLowSeverityByDefault],
  [
    "renderMarkdown includes info findings when enabled",
    testRenderMarkdownIncludesLowSeverityWhenEnabled
  ],
  ["renderAnnotations maps severities to workflow commands", testRenderAnnotationsMapsSeverityToCommands],
  ["renderAnnotations skips findings without a file", testRenderAnnotationsSkipsFindingsWithoutFile],
  ["renderAnnotations hides info findings by default", testRenderAnnotationsHidesInfoByDefault],
  ["renderAnnotations includes the line and recommendation", testRenderAnnotationsIncludesLineAndRecommendation],
  ["renderAnnotations escapes pull request content", testRenderAnnotationsEscapesPullRequestContent],
  ["config disables annotations by default", testConfigDisablesAnnotationsByDefault],
  ["renderMarkdown keeps hostile file paths inert", testRenderMarkdownKeepsHostilePathsInert],
  ["renderMarkdown fences backticks in file paths", testRenderMarkdownFencesBackticksInPaths],
  ["renderMarkdown escapes finding text", testRenderMarkdownEscapesFindingText],
  ["GitHub client sends authenticated JSON requests", testRequestSendsAuthenticatedJson],
  ["GitHub client returns undefined for 204 responses", testRequestReturnsUndefinedForNoContent],
  ["GitHub client fails with the response status", testRequestFailsWithStatus],
  ["GitHub client paginates until a short batch", testPaginateFollowsPagesUntilShortBatch],
  ["GitHub client stops paginating at the page limit", testPaginateStopsAtPageLimit],
  ["GitHub client truncates error details", testRequestTruncatesErrorDetails],
  ["GitHub client sets a request timeout", testRequestUsesTimeoutSignal],
  ["GitHub client sends requests to the configured API URL", testRequestUsesConfiguredApiUrl],
  ["resolveGitHubApiUrl defaults to api.github.com", testResolveGitHubApiUrlDefaultsToGitHubCom],
  ["resolveGitHubApiUrl normalizes Enterprise Server URLs", testResolveGitHubApiUrlNormalizesEnterpriseUrls],
  ["resolveGitHubApiUrl rejects invalid values", testResolveGitHubApiUrlRejectsInvalidValues],
  ["fetchPullRequestFiles normalizes the API response", testFetchPullRequestFilesNormalizesResponse],
  ["upsert creates a comment when the marker is missing", testUpsertCreatesCommentWhenMarkerIsMissing],
  ["upsert updates the existing Prism Review comment", testUpsertUpdatesExistingComment],
  ["upsert updates the most recent Prism Review comment", testUpsertUpdatesMostRecentMarkerComment],
  ["upsert ignores the marker in comments written by people", testUpsertIgnoresMarkerInHumanComments],
  ["upsert ignores bot comments that do not start with the marker", testUpsertIgnoresBotCommentsWithoutLeadingMarker],
  ["append mode always creates a new comment", testAppendModeAlwaysCreatesComment],
  ["upsert mode updates the existing comment", testUpsertModeUpdatesExistingComment],
  ["limitPatchSizes omits oversized patches", testLimitPatchSizesOmitsOversizedPatches],
  ["limitPatchSizes measures patches in bytes", testLimitPatchSizesCountsBytes],
  ["oversized patch rule reports omitted patches", testOversizedPatchRuleReportsOmittedPatches],
  ["prepareChangedFiles limits patches before redacting", testPrepareChangedFilesLimitsThenRedacts],
  ["redactSecrets keeps allowlisted values", testRedactSecretsKeepsAllowlistedValues],
  ["redactSecrets keeps allowlisted assignments", testRedactSecretsKeepsAllowlistedAssignments],
  ["redaction allowlist does not shield other secrets", testAllowlistDoesNotShieldOtherSecrets],
  ["config rejects invalid allowlist patterns", testConfigRejectsInvalidAllowlistPattern],
  ["prepareChangedFiles applies the redaction allowlist", testPrepareChangedFilesAppliesAllowlist],
  ["parseConfig applies defaults to partial config", testParseConfigAppliesDefaults],
  ["parseConfig fills the defaults of nested sections", testParseConfigFillsNestedDefaults],
  ["parseConfig treats an empty file as defaults", testParseConfigTreatsEmptyFileAsDefaults],
  ["parseConfig reports the source and field of invalid values", testParseConfigReportsSourceAndField],
  ["parseConfig labels errors at the document root", testParseConfigLabelsRootErrors],
  ["parseConfig reports YAML syntax errors with the source", testParseConfigReportsYamlErrors],
  ["parseUnifiedDiff records the source of renames", testParseUnifiedDiffRecordsRenameSource],
  ["parseUnifiedDiff reads the rename source from the rename line", testParseUnifiedDiffReadsRenameSourceFromRenameLine],
  ["config change rule flags the default config file", testConfigChangeRuleFlagsDefaultConfig],
  ["config change rule follows the configured path", testConfigChangeRuleUsesConfiguredPath],
  ["config change rule flags a renamed config file", testConfigChangeRuleFlagsRenamedConfig],
  ["fetchRepositoryFile decodes base64 file content", testFetchRepositoryFileDecodesContent],
  ["fetchRepositoryFile returns undefined for missing files", testFetchRepositoryFileReturnsUndefinedWhenMissing],
  ["fetchRepositoryFile rejects directories", testFetchRepositoryFileRejectsDirectories],
  ["fetchRepositoryFile rejects symlinks and submodules", testFetchRepositoryFileRejectsSymlinksAndSubmodules],
  ["fetchRepositoryFile rejects content it cannot decode", testFetchRepositoryFileRejectsUnreadableContent],
  ["fetchRepositoryFile propagates other API errors", testFetchRepositoryFilePropagatesOtherErrors],
  ["readInputs reads the variable names the runner sets", testReadInputsReadsRunnerVariableNames],
  ["readInputs defaults the config path", testReadInputsDefaultsConfigPath],
  ["readInputs normalizes the config path", testReadInputsNormalizesConfigPath],
  ["readInputs rejects config paths outside the repository", testReadInputsRejectsPathsOutsideRepository],
  ["loadBaseBranchConfig parses the base branch file", testLoadBaseBranchConfigParsesBaseFile],
  ["loadBaseBranchConfig returns undefined when the file is missing", testLoadBaseBranchConfigReturnsUndefinedWhenMissing],
  ["loadBaseBranchConfig names the base commit in errors", testLoadBaseBranchConfigNamesBaseCommitInErrors]
];

for (const [name, test] of tests) {
  await test();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} test(s) passed.`);
