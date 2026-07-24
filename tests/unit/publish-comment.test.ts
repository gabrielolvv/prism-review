import assert from "node:assert/strict";
import {
  publishPullRequestComment,
  upsertPullRequestComment
} from "../../src/github/publish-comment.js";
import { PRISM_COMMENT_MARKER } from "../../src/reporting/render-markdown.js";
import { createFakeGitHubClient } from "../support/fake-github-client.js";

const commentsPath = "/repos/acme/widgets/issues/12/comments";
const bot = { login: "github-actions[bot]", type: "Bot" };
const human = { login: "octocat", type: "User" };

export async function testUpsertCreatesCommentWhenMarkerIsMissing(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [{ id: 1, user: human, body: "Looks good to me." }, { id: 2 }]
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
      { id: 1, user: human, body: "Looks good to me." },
      { id: 41, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nprevious review` }
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

export async function testUpsertUpdatesMostRecentMarkerComment(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [
      { id: 41, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nfirst review` },
      { id: 42, user: human, body: "Please split this PR." },
      { id: 57, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nsecond review` }
    ]
  });

  await upsertPullRequestComment(client, "acme", "widgets", 12, "updated review");

  assert.equal(calls[1]?.path, "/repos/acme/widgets/issues/comments/57");
  assert.equal(calls[1]?.method, "PATCH");
}

export async function testUpsertIgnoresMarkerInHumanComments(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [
      { id: 41, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nprevious review` },
      { id: 42, user: human, body: `Checked that it contains \`${PRISM_COMMENT_MARKER}\`.` },
      { id: 43, user: human, body: `${PRISM_COMMENT_MARKER}\n\nfake review` },
      { id: 44, user: human, body: `> ${PRISM_COMMENT_MARKER}\n> quoted review` }
    ]
  });

  await upsertPullRequestComment(client, "acme", "widgets", 12, "updated review");

  assert.equal(calls[1]?.path, "/repos/acme/widgets/issues/comments/41");
  assert.equal(calls[1]?.method, "PATCH");
}

export async function testUpsertIgnoresBotCommentsWithoutLeadingMarker(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [
      { id: 41, user: { login: "other-app[bot]", type: "Bot" }, body: `See ${PRISM_COMMENT_MARKER}` }
    ]
  });

  await upsertPullRequestComment(client, "acme", "widgets", 12, "new review");

  assert.equal(calls[1]?.path, commentsPath);
  assert.equal(calls[1]?.method, "POST");
}

export async function testAppendModeAlwaysCreatesComment(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [{ id: 41, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nprevious review` }]
  });

  await publishPullRequestComment(client, "acme", "widgets", 12, "new review", "append");

  assert.deepEqual(calls, [
    { path: commentsPath, method: "POST", body: { body: "new review" } }
  ]);
}

export async function testUpsertModeUpdatesExistingComment(): Promise<void> {
  const { client, calls } = createFakeGitHubClient({
    [commentsPath]: [{ id: 41, user: bot, body: `${PRISM_COMMENT_MARKER}\n\nprevious review` }]
  });

  await publishPullRequestComment(client, "acme", "widgets", 12, "updated review", "upsert");

  assert.equal(calls[1]?.path, "/repos/acme/widgets/issues/comments/41");
  assert.equal(calls[1]?.method, "PATCH");
}
