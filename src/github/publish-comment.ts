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

export async function publishPullRequestComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  mode: CommentMode
): Promise<void> {
  if (mode === "append") {
    await createComment(client, owner, repo, issueNumber, body);
    return;
  }

  await upsertPullRequestComment(client, owner, repo, issueNumber, body);
}

export async function upsertPullRequestComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  const comments = await client.paginate<GitHubComment>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`
  );

  // Append mode can leave several marked comments behind; keep the newest one current.
  const existing = [...comments].reverse().find(isPrismReviewComment);

  if (existing) {
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
