import assert from "node:assert/strict";
import { upsertPullRequestComment } from "../../src/github/publish-comment.js";
import { PRISM_COMMENT_MARKER } from "../../src/reporting/render-markdown.js";
import { createFakeGitHubClient } from "../support/fake-github-client.js";

const commentsPath = "/repos/acme/widgets/issues/12/comments";

export async function testUpsertCreatesCommentWhenMarkerIsMissing(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [{ id: 1, body: "Looks good to me." }, { id: 2 }]
  });

  await upsertPullRequestComment(client, "acme", "widgets", 12, "new review");

  assert.deepEqual(calls[1], {
    path: commentsPath,
    method: "POST",
    body: { body: "new review" }
  });
  assert.equal(calls.length, 2);
}

export async function testUpsertUpdatesExistingComment(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [
      { id: 1, body: "Looks good to me." },
      { id: 41, body: `${PRISM_COMMENT_MARKER}\n\nprevious review` }
    ]
  });

  await upsertPullRequestComment(client, "acme", "widgets", 12, "updated review");

  assert.deepEqual(calls[1], {
    path: "/repos/acme/widgets/issues/comments/41",
    method: "PATCH",
    body: { body: "updated review" }
  });
  assert.equal(calls.length, 2);
}
