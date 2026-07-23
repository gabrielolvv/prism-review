import assert from "node:assert/strict";
import { createGitHubClient, GitHubApiError } from "../../src/github/client.js";
import { fetchRepositoryFile } from "../../src/github/fetch-repository-file.js";
import { withMockFetch } from "../support/mock-fetch.js";

export async function testFetchRepositoryFileDecodesContent(): Promise<void> {
  const encoded = Buffer.from("risk:\n  largeDiff:\n    maxFiles: 5\n").toString("base64");
  // The contents API wraps base64 payloads across lines.
  const wrapped = `${encoded.slice(0, 20)}\n${encoded.slice(20)}\n`;

  await withMockFetch(
    () => ({ json: { type: "file", encoding: "base64", content: wrapped } }),
    async (requests) => {
      const client = createGitHubClient("test-token");

      const content = await fetchRepositoryFile(
        client,
        "acme",
        "widgets",
        "config/prism review.yml",
        "abc123"
      );

      assert.equal(content, "risk:\n  largeDiff:\n    maxFiles: 5\n");
      assert.equal(
        requests[0]?.url,
        "https://api.github.com/repos/acme/widgets/contents/config/prism%20review.yml?ref=abc123"
      );
    }
  );
}

export async function testFetchRepositoryFileReturnsUndefinedWhenMissing(): Promise<void> {
  await withMockFetch(
    () => ({ status: 404, text: '{"message":"Not Found"}' }),
    async () => {
      const client = createGitHubClient("test-token");

      const content = await fetchRepositoryFile(client, "acme", "widgets", ".prism-review.yml", "abc123");

      assert.equal(content, undefined);
    }
  );
}

export async function testFetchRepositoryFileRejectsDirectories(): Promise<void> {
  await withMockFetch(
    () => ({ json: [{ type: "file", name: "prism.yml" }] }),
    async () => {
      const client = createGitHubClient("test-token");

      await assert.rejects(
        fetchRepositoryFile(client, "acme", "widgets", "config", "abc123"),
        /^Error: config is not a file at abc123\.$/
      );
    }
  );
}

export async function testFetchRepositoryFileRejectsUnreadableContent(): Promise<void> {
  await withMockFetch(
    () => ({ json: { type: "file", encoding: "none", content: "" } }),
    async () => {
      const client = createGitHubClient("test-token");

      await assert.rejects(
        fetchRepositoryFile(client, "acme", "widgets", ".prism-review.yml", "abc123"),
        /too large to read through the contents API/
      );
    }
  );
}

export async function testFetchRepositoryFilePropagatesOtherErrors(): Promise<void> {
  await withMockFetch(
    () => ({ status: 403, text: "Resource not accessible by integration" }),
    async () => {
      const client = createGitHubClient("test-token");

      await assert.rejects(
        fetchRepositoryFile(client, "acme", "widgets", ".prism-review.yml", "abc123"),
        (error: unknown) => error instanceof GitHubApiError && error.status === 403
      );
    }
  );
}
