import {
  testPaginateFollowsPagesUntilShortBatch,
  testPaginateStopsAtPageLimit,
  testRequestFailsWithStatus,
  testRequestReturnsUndefinedForNoContent,
  testRequestSendsAuthenticatedJson,
  testRequestTruncatesErrorDetails,
  testRequestUsesTimeoutSignal
} from "./unit/github-client.test.js";
import { testFetchPullRequestFilesNormalizesResponse } from "./unit/fetch-pull-request.test.js";
import {
  testLimitPatchSizesCountsBytes,
  testLimitPatchSizesOmitsOversizedPatches,
  testOversizedPatchRuleReportsOmittedPatches
} from "./unit/limit-patches.test.js";
import { testParseUnifiedDiff } from "./unit/parse-unified-diff.test.js";
import { testPrepareChangedFilesLimitsThenRedacts } from "./unit/prepare-changed-files.test.js";
import {
  testAppendModeAlwaysCreatesComment,
  testUpsertCreatesCommentWhenMarkerIsMissing,
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
  testRenderMarkdown,
  testRenderMarkdownHidesLowSeverityByDefault,
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
  ["GitHub client sends authenticated JSON requests", testRequestSendsAuthenticatedJson],
  ["GitHub client returns undefined for 204 responses", testRequestReturnsUndefinedForNoContent],
  ["GitHub client fails with the response status", testRequestFailsWithStatus],
  ["GitHub client paginates until a short batch", testPaginateFollowsPagesUntilShortBatch],
  ["GitHub client stops paginating at the page limit", testPaginateStopsAtPageLimit],
  ["GitHub client truncates error details", testRequestTruncatesErrorDetails],
  ["GitHub client sets a request timeout", testRequestUsesTimeoutSignal],
  ["fetchPullRequestFiles normalizes the API response", testFetchPullRequestFilesNormalizesResponse],
  ["upsert creates a comment when the marker is missing", testUpsertCreatesCommentWhenMarkerIsMissing],
  ["upsert updates the existing Prism Review comment", testUpsertUpdatesExistingComment],
  ["upsert updates the most recent Prism Review comment", testUpsertUpdatesMostRecentMarkerComment],
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
  ["prepareChangedFiles applies the redaction allowlist", testPrepareChangedFilesAppliesAllowlist]
];

for (const [name, test] of tests) {
  await test();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} test(s) passed.`);
