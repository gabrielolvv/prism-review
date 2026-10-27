import type { GitHubClient } from "./client.js";
import type { PrismConfig } from "../config/schema.js";
import { PRISM_COMMENT_MARKER } from "../reporting/render-markdown.js";

type GitHubComment = {
  id: number;
  body?: string;
  user?: {
    type?: string;
  };
};

export type CommentMode = PrismConfig["comment"]["mode"];

export type ReviewComment = { id: number; body: string };

export async function publishPullRequestComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  mode: CommentMode
): Promise<void> {
  const existing = mode === "upsert" ? await findReviewComment(client, owner, repo, issueNumber) : undefined;
  await publishReviewComment(client, owner, repo, issueNumber, body, mode, existing);
}

export async function upsertPullRequestComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await publishPullRequestComment(client, owner, repo, issueNumber, body, "upsert");
}

// The newest review comment, which upsert mode updates and the next review compares with.
// Append mode can leave several marked comments behind; the newest is the current one.
export async function findReviewComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<ReviewComment | undefined> {
  const comments = await client.paginate<GitHubComment>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`
  );
  const existing = [...comments].reverse().find(isPrismReviewComment);
  return existing === undefined ? undefined : { id: existing.id, body: existing.body ?? "" };
}

// `existing` is the comment findReviewComment returned, which upsert mode updates.
export async function publishReviewComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  mode: CommentMode,
  existing: ReviewComment | undefined
): Promise<void> {
  if (mode === "upsert" && existing !== undefined) {
    await client.request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: { body }
    });
    return;
  }

  await createComment(client, owner, repo, issueNumber, body);
}

// Anyone who can comment can paste the marker, so only a bot comment that starts with it counts.
function isPrismReviewComment(comment: GitHubComment): boolean {
  return comment.user?.type === "Bot" && (comment.body?.startsWith(PRISM_COMMENT_MARKER) ?? false);
}

async function createComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await client.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body }
  });
}
