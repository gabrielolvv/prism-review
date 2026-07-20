import { readFileSync } from "node:fs";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { loadConfig } from "../config/load-config.js";
import { createGitHubClient } from "../github/client.js";
import { fetchPullRequestFiles } from "../github/fetch-pull-request.js";
import { upsertPullRequestComment } from "../github/publish-comment.js";
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
  const config = loadConfig(inputs.configPath);
  const files = prepareChangedFiles(
    await fetchPullRequestFiles(client, owner, repo, pullRequest.number),
    config
  );
  const result = analyzePullRequest(files, config);
  const body = renderMarkdown(result, config.comment);

  if (inputs.dryRun) {
    console.log(body);
    return;
  }

  await upsertPullRequestComment(client, owner, repo, pullRequest.number, body);
}

type PullRequestEvent = {
  pull_request?: {
    number: number;
  };
};

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
