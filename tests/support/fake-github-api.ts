// Preloaded with `node --import` so the bundled action talks to an in-memory GitHub API.
// Every request is reported on stderr as a `[fake-github]` JSON line for the smoke test to inspect.

export const fakeBaseSha = "0123456789abcdef0123456789abcdef01234567";
export const fakeAppendBaseSha = "fedcba9876543210fedcba9876543210fedcba98";

const marker = "<!-- prism-review-comment -->";

// Each value differs from the defaults, so a finding proves which configuration was used.
const baseConfig = [
  "risk:",
  "  largeDiff:",
  "    maxFiles: 1",
  "security:",
  "  maxPatchBytes: 40",
  "comment:",
  "  includeLowSeverity: true",
  ""
].join("\n");

const appendConfig = "comment:\n  mode: append\n";

const routes: Record<string, (body: unknown) => unknown> = {
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeBaseSha}`]: () =>
    fileContent(baseConfig),
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeAppendBaseSha}`]: () =>
    fileContent(appendConfig),
  "GET /repos/acme/widgets/pulls/7/files?per_page=100&page=1": () => [
    {
      filename: ".prism-review.yml",
      status: "modified",
      additions: 1,
      deletions: 1,
      patch: "-    maxFiles: 1\n+    maxFiles: 500"
    },
    {
      filename: "config/prism.yml",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: "+risk: {}"
    },
    {
      filename: "src/billing/charge.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: "+export const chargeTimeoutMs = 30_000; // retry budget for the payment gateway"
    }
  ],
  "GET /repos/acme/widgets/issues/7/comments?per_page=100&page=1": () => [
    { id: 5, user: { login: "github-actions[bot]", type: "Bot" }, body: `${marker}\n\nprevious review` },
    { id: 6, user: { login: "octocat", type: "User" }, body: `${marker}\n\nnot a real review` }
  ],
  "POST /repos/acme/widgets/issues/7/comments": () => ({ id: 8 }),
  "PATCH /repos/acme/widgets/issues/comments/5": () => ({ id: 5 })
};

function fileContent(value: string) {
  return { type: "file", encoding: "base64", content: Buffer.from(value).toString("base64") };
}

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  // Serves github.com and Enterprise Server (`/api/v3`) URLs; `url` lets scenarios check which was used.
  const path = url.replace(/^https?:\/\/[^/]+(\/api\/v3)?/, "");
  const method = init.method ?? "GET";
  const headers = (init.headers ?? {}) as Record<string, string>;
  const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  process.stderr.write(
    `[fake-github] ${JSON.stringify({ method, url, path, authorization: headers.Authorization, body })}\n`
  );

  const route = routes[`${method} ${path}`];
  if (!route) {
    return new Response('{"message":"Not Found"}', { status: 404 });
  }

  return new Response(JSON.stringify(route(body)), { status: 200 });
}) as typeof fetch;
