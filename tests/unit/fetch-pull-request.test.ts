import assert from "node:assert/strict";
import { fetchPullRequestFiles } from "../../src/github/fetch-pull-request.js";
import { createFakeGitHubClient } from "../support/fake-github-client.js";

export async function testFetchPullRequestFilesNormalizesResponse(): Promise<void> {
  const { client } = createFakeGitHubClient({
    "/repos/acme/widgets/pulls/12/files": [
      {
        filename: "src/auth/session.ts",
        status: "modified",
        additions: 4,
        deletions: 1,
        patch: "@@ -1 +1 @@"
      },
      { filename: "docs/old-name.md", status: "renamed", additions: 0, deletions: 0 },
      { filename: "assets/logo.png", status: "changed", additions: 0, deletions: 0 }
    ]
  });

  const files = await fetchPullRequestFiles(client, "acme", "widgets", 12);

  assert.deepEqual(files, [
    {
      path: "src/auth/session.ts",
      status: "modified",
      additions: 4,
      deletions: 1,
      patch: "@@ -1 +1 @@"
    },
    { path: "docs/old-name.md", status: "renamed", additions: 0, deletions: 0, patch: undefined },
    { path: "assets/logo.png", status: "modified", additions: 0, deletions: 0, patch: undefined }
  ]);
}
