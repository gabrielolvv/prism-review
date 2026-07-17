import assert from "node:assert/strict";
import { createGitHubClient } from "../../src/github/client.js";
import { withMockFetch } from "../support/mock-fetch.js";

export async function testRequestSendsAuthenticatedJson(): Promise<void> {
  await withMockFetch(
    () => ({ json: { id: 7 } }),
    async (requests) => {
      const client = createGitHubClient("test-token");

      const result = await client.request<{ id: number }>("/repos/acme/widgets/issues/1/comments", {
        method: "POST",
        body: { body: "hello" }
      });

      assert.deepEqual(result, { id: 7 });
      assert.equal(requests.length, 1);
      assert.equal(
        requests[0]?.url,
        "https://api.github.com/repos/acme/widgets/issues/1/comments"
      );
      assert.equal(requests[0]?.method, "POST");
      assert.equal(requests[0]?.headers.Authorization, "Bearer test-token");
      assert.deepEqual(requests[0]?.body, { body: "hello" });
    }
  );
}

export async function testRequestReturnsUndefinedForNoContent(): Promise<void> {
  await withMockFetch(
    () => ({ status: 204 }),
    async () => {
      const client = createGitHubClient("test-token");

      const result = await client.request("/repos/acme/widgets/issues/comments/1");

      assert.equal(result, undefined);
    }
  );
}

export async function testRequestFailsWithStatus(): Promise<void> {
  await withMockFetch(
    () => ({ status: 403, text: "Resource not accessible by integration" }),
    async () => {
      const client = createGitHubClient("test-token");

      await assert.rejects(
        client.request("/repos/acme/widgets/pulls/1/files"),
        /GitHub API request failed: 403 Resource not accessible by integration/
      );
    }
  );
}

export async function testPaginateFollowsPagesUntilShortBatch(): Promise<void> {
  await withMockFetch(
    (request) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      return { json: page === 1 ? numbered(100, 0) : numbered(3, 100) };
    },
    async (requests) => {
      const client = createGitHubClient("test-token");

      const items = await client.paginate<{ id: number }>("/repos/acme/widgets/pulls/1/files");

      assert.equal(items.length, 103);
      assert.equal(items[102]?.id, 102);
      assert.deepEqual(
        requests.map((request) => new URL(request.url).search),
        ["?per_page=100&page=1", "?per_page=100&page=2"]
      );
    }
  );
}

function numbered(count: number, offset: number): Array<{ id: number }> {
  return Array.from({ length: count }, (_, index) => ({ id: offset + index }));
}
