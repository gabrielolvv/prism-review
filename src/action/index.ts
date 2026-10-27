import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { describeFailure, failingFindings } from "../analysis/check-outcome.js";
import { defaultConfig } from "../config/schema.js";
import type { Finding } from "../analysis/finding.js";
import { createGitHubClient, GitHubApiError, resolveGitHubApiUrl, type GitHubClient } from "../github/client.js";
import { fetchPullRequestFiles } from "../github/fetch-pull-request.js";
import { syncLineComments, type LineCommentOptions } from "../github/line-comments.js";
import { loadBaseBranchConfig } from "../github/load-base-config.js";
import { findReviewComment, publishReviewComment } from "../github/publish-comment.js";
import { renderAnnotations } from "../reporting/render-annotations.js";
import { renderMarkdown } from "../reporting/render-markdown.js";
import { readState } from "../reporting/review-state.js";
import { renderSarif } from "../reporting/render-sarif.js";
import { defaultRules } from "../rules/index.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { readInputs } from "./inputs.js";
import { writeJobSummary, writeOutputs, writeSarif } from "./report.js";

async function run(): Promise<void> {
  const inputs = readInputs();
  const pullRequest = readGitHubEvent().pull_request;

  if (!pullRequest) {
    console.log("Prism Review only runs on pull_request events.");
    return;
  }

  const { owner, repo } = readRepository();
  const client = createGitHubClient(
    inputs.githubToken,
    resolveGitHubApiUrl(process.env.GITHUB_API_URL)
  );
  const baseConfig = await loadBaseBranchConfig(
    client,
    owner,
    repo,
    inputs.configPath,
    readBaseSha(pullRequest)
  );
  if (!baseConfig) {
    console.log(`No ${inputs.configPath} on the base branch; using the default configuration.`);
  }

  const config = baseConfig ?? defaultConfig;
  const files = prepareChangedFiles(
    await fetchPullRequestFiles(client, owner, repo, pullRequest.number),
    config
  );
  const result = analyzePullRequest(files, config, {
    configPath: inputs.configPath,
    expectedFileCount: pullRequest.changed_files
  });
  // Read before rendering, so the review can mark what changed since the previous one. A dry run
  // makes no comment API calls, so it does not compare.
  const previous = inputs.dryRun ? undefined : await findReviewComment(client, owner, repo, pullRequest.number);
  const body = renderMarkdown(result, {
    includeLowSeverity: config.comment.includeLowSeverity,
    previous: previous === undefined ? undefined : readState(previous.body),
    recordState: true
  });

  if (config.annotations.enabled) {
    for (const annotation of renderAnnotations(result, config.annotations)) {
      console.log(annotation);
    }
  }

  writeOutputs(result);
  writeJobSummary(body);
  if (inputs.sarifFile !== undefined) {
    writeSarif(inputs.sarifFile, renderSarif(result, defaultRules));
  }

  if (inputs.dryRun) {
    printUntrusted(body);
  } else {
    try {
      await publishReviewComment(client, owner, repo, pullRequest.number, body, config.comment.mode, previous);
      if (config.reviewComments.enabled) {
        await publishLineComments(client, owner, repo, pullRequest, result.findings, config.reviewComments);
      }
    } catch (error) {
      // A pull request from a fork gets a read-only token, so the comment cannot be posted. That is
      // not the pull request's fault, and the review is still in the job summary. In the same
      // repository a 403 means the workflow lacks pull-requests: write, which should fail.
      if (!isReadOnlyForkToken(error, pullRequest, owner, repo)) {
        throw error;
      }

      console.log(
        "::warning title=Prism Review::Could not post the review comment because the token is read-only for pull requests from forks. The review is in the job summary."
      );
    }
  }

  // Fail only after the review is published, so the reason is on the pull request.
  const failing = failingFindings(result, config.check.failOn);
  if (failing.length > 0) {
    console.error(describeFailure(failing, config.check.failOn));
    process.exitCode = 1;
  }
}

async function publishLineComments(
  client: GitHubClient,
  owner: string,
  repo: string,
  pullRequest: PullRequest,
  findings: Finding[],
  options: LineCommentOptions
): Promise<void> {
  const headSha = pullRequest.head?.sha;
  if (headSha === undefined) {
    console.log("::warning title=Prism Review::The event has no head commit, so no review comments were posted.");
    return;
  }

  const outcome = await syncLineComments(client, owner, repo, pullRequest.number, headSha, findings, options);
  console.log(
    `Review comments: ${outcome.created} posted, ${outcome.updated} updated, ${outcome.resolved} marked resolved.`
  );
  if (outcome.rejected > 0) {
    console.log(
      `::warning title=Prism Review::${outcome.rejected} line finding(s) are outside the diff GitHub accepts comments on; they are in the review comment.`
    );
  }
  if (outcome.skipped > 0) {
    console.log(
      `::notice title=Prism Review::${outcome.skipped} line finding(s) are over reviewComments.maxComments; they are in the review comment.`
    );
  }
}

// The body quotes pull request file names, which may contain newlines followed by workflow
// commands. The runner ignores commands until it sees the unguessable token again.
function printUntrusted(text: string): void {
  const token = randomUUID();
  console.log(`::stop-commands::${token}`);
  console.log(text);
  console.log(`::${token}::`);
}

type PullRequest = {
  number: number;
  changed_files?: number;
  base?: {
    sha?: string;
  };
  head?: {
    sha?: string;
    repo?: {
      full_name?: string;
    } | null;
  };
};

// Only the pull_request event gives forks a read-only token; pull_request_target can write, and a
// rate-limit 403 is a real failure, so both of those still fail the run.
function isReadOnlyForkToken(error: unknown, pullRequest: PullRequest, owner: string, repo: string): boolean {
  return (
    error instanceof GitHubApiError &&
    error.status === 403 &&
    !/rate limit/i.test(error.message) &&
    process.env.GITHUB_EVENT_NAME === "pull_request" &&
    isFromFork(pullRequest, owner, repo)
  );
}

// A deleted head repository (`repo: null`) can only belong to a fork. A payload with no head
// information at all is not treated as a fork, so its 403 still fails.
function isFromFork(pullRequest: PullRequest, owner: string, repo: string): boolean {
  const headRepository = pullRequest.head?.repo;
  if (headRepository === null) {
    return true;
  }

  const fullName = headRepository?.full_name;
  return fullName !== undefined && fullName.toLowerCase() !== `${owner}/${repo}`.toLowerCase();
}

type PullRequestEvent = {
  pull_request?: PullRequest;
};

function readBaseSha(pullRequest: PullRequest): string {
  const sha = pullRequest.base?.sha;
  if (!sha) {
    throw new Error("The pull_request event payload has no base commit SHA.");
  }

  return sha;
}

function readGitHubEvent(): PullRequestEvent {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is not set.");
  }

  return JSON.parse(readFileSync(eventPath, "utf8")) as PullRequestEvent;
}

function readRepository(): { owner: string; repo: string } {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is not set.");
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  return { owner, repo };
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
