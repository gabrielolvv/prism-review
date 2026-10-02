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
import { testDefaultRules, testDependencyRiskRule } from "./unit/rules.test.js";

type Test = () => void | Promise<void>;

const tests: Array<[string, Test]> = [
  ["parseUnifiedDiff parses changed files", testParseUnifiedDiff],
  ["default rules flag sensitive files and missing tests", testDefaultRules],
  ["dependency risk rule flags manifest and lockfile changes", testDependencyRiskRule],
  ["redactSecrets masks token-like values", testRedactSecrets],
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
