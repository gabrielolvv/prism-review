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

  assert.equal(config?.config.risk.largeDiff.maxFiles, 3);
  assert.deepEqual(config?.extendedPaths, []);
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

export async function testLoadBaseBranchConfigFollowsExtends(): Promise<void> {
  const localPath = `/repos/acme/widgets/contents/.github/prism-review-base.yml?ref=${baseSha}`;
  const remotePath = "/repos/acme/policies/contents/prism/review.yml?ref=v2";
  const { client, calls } = createFakeGitHubClient(
    {},
    {
      [contentsPath]: fileContent("extends: .github/prism-review-base.yml\ncheck:\n  failOn: high\n"),
      // The repository's file extends one in the same repository, which extends the organization's.
      [localPath]: fileContent(
        "extends: acme/policies/prism/review.yml@v2\nrisk:\n  largeDiff:\n    maxFiles: 10\nignorePaths:\n  - vendor/**\n"
      ),
      [remotePath]: fileContent("risk:\n  largeDiff:\n    maxFiles: 50\n    maxChangedLines: 2000\ncheck:\n  failOn: warning\nignorePaths:\n  - dist/**\n")
    }
  );

  const loaded = await loadBaseBranchConfig(client, "acme", "widgets", ".prism-review.yml", baseSha);

  // Objects merge key by key, and lists and values from the extending file win.
  assert.equal(loaded?.config.risk.largeDiff.maxFiles, 10);
  assert.equal(loaded?.config.risk.largeDiff.maxChangedLines, 2000);
  assert.equal(loaded?.config.check.failOn, "high");
  assert.deepEqual(loaded?.config.ignorePaths, ["vendor/**"]);
  assert.deepEqual(loaded?.extendedPaths, [".github/prism-review-base.yml"]);
  assert.deepEqual(
    calls.map((call) => call.path),
    [contentsPath, localPath, remotePath]
  );
}

export async function testLoadBaseBranchConfigRejectsBadExtends(): Promise<void> {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ [contentsPath]: fileContent("extends: ../outside.yml\n") }, /extends must be a path in this repository/],
    // Without @ref it is a path in this repository.
    [
      {
        [contentsPath]: fileContent("extends: acme/policies/review.yml\n"),
        [`/repos/acme/widgets/contents/acme/policies/review.yml?ref=${baseSha}`]: new GitHubApiError(404, "{}")
      },
      /extends acme\/policies\/review\.yml, which was not found\.$/
    ],
    [
      { [contentsPath]: fileContent("extends: acme/policies/review.yml@main\n"), "/repos/acme/policies/contents/review.yml?ref=main": new GitHubApiError(404, "{}") },
      /extends acme\/policies\/review\.yml@main, which was not found or the token cannot read it\./
    ],
    [
      {
        [contentsPath]: fileContent("extends: base.yml\n"),
        [`/repos/acme/widgets/contents/base.yml?ref=${baseSha}`]: fileContent("extends: .prism-review.yml\n")
      },
      /extends \.prism-review\.yml, which extends it back\./
    ]
  ];
  for (const [responses, error] of cases) {
    const { client } = createFakeGitHubClient({}, responses as never);
    await assert.rejects(loadBaseBranchConfig(client, "acme", "widgets", ".prism-review.yml", baseSha), error);
  }
}

function fileContent(value: string) {
  return { type: "file", encoding: "base64", content: Buffer.from(value).toString("base64") };
}
