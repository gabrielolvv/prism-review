import { readFileSync } from "node:fs";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { defaultConfig } from "../config/schema.js";
import { createGitHubClient } from "../github/client.js";
import { fetchPullRequestFiles } from "../github/fetch-pull-request.js";
import { loadBaseBranchConfig } from "../github/load-base-config.js";
import { publishPullRequestComment } from "../github/publish-comment.js";
import { renderMarkdown } from "../reporting/render-markdown.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { readInputs } from "./inputs.js";

async function run(): Promise<void> {
  const inputs = readInputs();
  const pullRequest = readGitHubEvent().pull_request;

  if (!pullRequest) {
    console.log("Prism Review only runs on pull_request events.");
    return;
  }

  const { owner, repo } = readRepository();
  const client = createGitHubClient(inputs.githubToken);
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
  const result = analyzePullRequest(files, config, { configPath: inputs.configPath });
  const body = renderMarkdown(result, config.comment);

  if (inputs.dryRun) {
    console.log(body);
    return;
  }

  await publishPullRequestComment(
    client,
    owner,
    repo,
    pullRequest.number,
    body,
    config.comment.mode
  );
}

type PullRequest = {
  number: number;
  base?: {
    sha?: string;
  };
};

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
