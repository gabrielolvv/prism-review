import type { GitHubClient } from "./client.js";
import { PRISM_COMMENT_MARKER } from "../reporting/render-markdown.js";

type GitHubComment = {
  id: number;
  body?: string;
};

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

  const existing = comments.find((comment) => comment.body?.includes(PRISM_COMMENT_MARKER));

  if (existing) {
    await client.request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: { body }
    });
    return;
  }

  await client.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body }
  });
}
