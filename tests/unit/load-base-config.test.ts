import assert from "node:assert/strict";
import { GitHubApiError } from "../../src/github/client.js";
import { loadBaseBranchConfig } from "../../src/github/load-base-config.js";
import { createFakeGitHubClient } from "../support/fake-github-client.js";

const baseSha = "0123456789abcdef0123456789abcdef01234567";
const contentsPath = `/repos/acme/widgets/contents/.prism-review.yml?ref=${baseSha}`;

export async function testLoadBaseBranchConfigParsesBaseFile(): Promise<void> {
  const { client, calls } = createFakeGitHubClient(
    {},
    { [contentsPath]: fileContent("risk:\n  largeDiff:\n    maxFiles: 3\n") }
  );

  const config = await loadBaseBranchConfig(client, "acme", "widgets", ".prism-review.yml", baseSha);

  assert.equal(config?.risk.largeDiff.maxFiles, 3);
  assert.deepEqual(calls, [{ path: contentsPath, method: "GET", body: undefined }]);
}

export async function testLoadBaseBranchConfigReturnsUndefinedWhenMissing(): Promise<void> {
  const { client } = createFakeGitHubClient(
    {},
    { [contentsPath]: new GitHubApiError(404, '{"message":"Not Found"}') }
  );

  const config = await loadBaseBranchConfig(client, "acme", "widgets", ".prism-review.yml", baseSha);

  assert.equal(config, undefined);
}

export async function testLoadBaseBranchConfigNamesBaseCommitInErrors(): Promise<void> {
  const { client } = createFakeGitHubClient(
    {},
    { [contentsPath]: fileContent("comment:\n  mode: sideways\n") }
  );

  await assert.rejects(
    loadBaseBranchConfig(client, "acme", "widgets", ".prism-review.yml", baseSha),
    /^Error: Invalid Prism Review configuration in \.prism-review\.yml at 0123456: comment\.mode: /
  );
}

function fileContent(value: string) {
  return { type: "file", encoding: "base64", content: Buffer.from(value).toString("base64") };
}
