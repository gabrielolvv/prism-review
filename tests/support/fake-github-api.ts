// Preloaded with `node --import` so the bundled action talks to an in-memory GitHub API.
// Every request is reported on stderr as a `[fake-github]` JSON line for the smoke test to inspect.

export const fakeBaseSha = "0123456789abcdef0123456789abcdef01234567";

const baseConfig = "risk:\n  largeDiff:\n    maxFiles: 1\n";

const routes: Record<string, (body: unknown) => unknown> = {
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeBaseSha}`]: () => ({
    type: "file",
    encoding: "base64",
    content: Buffer.from(baseConfig).toString("base64")
  }),
  "GET /repos/acme/widgets/pulls/7/files?per_page=100&page=1": () => [
    {
      filename: ".prism-review.yml",
      status: "modified",
      additions: 1,
      deletions: 1,
      patch: "-    maxFiles: 1\n+    maxFiles: 500"
    },
    {
      filename: "src/billing/charge.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: '+const OPENAI_API_KEY = "sk-thisShouldNeverAppearInReviewOutput1234567890";'
    }
  ],
  "GET /repos/acme/widgets/issues/7/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/7/comments": () => ({ id: 1 })
};

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const path = String(input).replace("https://api.github.com", "");
  const method = init.method ?? "GET";
  const headers = (init.headers ?? {}) as Record<string, string>;
  const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  process.stderr.write(
    `[fake-github] ${JSON.stringify({ method, path, authorization: headers.Authorization, body })}\n`
  );

  const route = routes[`${method} ${path}`];
  if (!route) {
    return new Response('{"message":"Not Found"}', { status: 404 });
  }

  return new Response(JSON.stringify(route(body)), { status: 200 });
}) as typeof fetch;
