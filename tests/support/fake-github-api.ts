// Preloaded with `node --import` so the bundled action talks to an in-memory GitHub API.
// Every request is reported on stderr as a `[fake-github]` JSON line for the smoke test to inspect.

import { renderState } from "../../src/reporting/review-state.js";

export const fakeBaseSha = "0123456789abcdef0123456789abcdef01234567";
export const fakeAppendBaseSha = "fedcba9876543210fedcba9876543210fedcba98";
export const fakeAnnotationsBaseSha = "00112233445566778899aabbccddeeff00112233";
export const fakeFailOnHighBaseSha = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
export const fakeReviewCommentsBaseSha = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
export const fakeComparisonBaseSha = "2323232323232323232323232323232323232323";
export const fakeLockfileBaseSha = "2525252525252525252525252525252525252525";
export const fakeHeadSha = "9999999999999999999999999999999999999999";
export const fakeLeakedToken = `ghp_${"Zx9".repeat(12)}`;

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
  "annotations:",
  "  enabled: true",
  ""
].join("\n");

const appendConfig = "comment:\n  mode: append\n";

const annotationsConfig = "annotations:\n  enabled: true\n";

const failOnHighConfig = "check:\n  failOn: high\n";

const reviewCommentsConfig = "reviewComments:\n  enabled: true\n";

class ErrorResponse {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {}
}

const routes: Record<string, (body: unknown) => unknown> = {
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeReviewCommentsBaseSha}`]: () =>
    fileContent(reviewCommentsConfig),
  "GET /repos/acme/widgets/pulls/21/files?per_page=100&page=1": () => [
    { filename: "app/db.py", status: "added", additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+cursor.execute(f"SELECT * FROM t WHERE id = {x}")' },
    { filename: "app/outside.py", status: "added", additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+cursor.execute(f"SELECT * FROM u WHERE id = {y}")' }
  ],
  "GET /repos/acme/widgets/issues/21/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/21/comments": () => ({ id: 20 }),
  "GET /repos/acme/widgets/pulls/21/comments?per_page=100&page=1": () => [
    { id: 77, path: "src/old.ts", line: 3, user: { type: "Bot" }, body: "<!-- prism-review-line risky-api -->\nold finding" }
  ],
  // GitHub rejects a comment on a line it does not count as part of the diff.
  "POST /repos/acme/widgets/pulls/21/comments": (body) =>
    (body as { path?: string }).path === "app/outside.py"
      ? new ErrorResponse(422, { message: "Validation Failed", errors: ["line must be part of the diff"] })
      : { id: 101 },
  "PATCH /repos/acme/widgets/pulls/comments/77": () => ({ id: 77 }),
  "GET /repos/acme/widgets/pulls/13/files?per_page=100&page=1": () => [
    { filename: "src/auth/login.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1,2 @@\n x\n+y" }
  ],
  "GET /repos/acme/widgets/issues/13/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/13/comments": () =>
    new ErrorResponse(403, { message: "Resource not accessible by integration" }),
  "GET /repos/acme/widgets/pulls/15/files?per_page=100&page=1": () => [
    { filename: "docs/readme.md", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1,2 @@\n x\n+y" }
  ],
  "GET /repos/acme/widgets/issues/15/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/15/comments": () =>
    new ErrorResponse(403, { message: "You have exceeded a secondary rate limit." }),
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeBaseSha}`]: () =>
    fileContent(baseConfig),
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeAppendBaseSha}`]: () =>
    fileContent(appendConfig),
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeAnnotationsBaseSha}`]: () =>
    fileContent(annotationsConfig),
  [`GET /repos/acme/widgets/contents/.prism-review.yml?ref=${fakeFailOnHighBaseSha}`]: () =>
    fileContent(failOnHighConfig),
  "GET /repos/acme/widgets/pulls/11/files?per_page=100&page=1": () => [
    {
      filename: "scripts/publish.sh",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: `@@ -4,3 +4,4 @@ set -eu\n cd dist\n npm pack\n+export GH_TOKEN=${fakeLeakedToken}\n gh release upload "$TAG" *.tgz`
    }
  ],
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
  // Git allows newlines in file names, so a pull request can smuggle workflow commands into a path.
  "GET /repos/acme/widgets/pulls/9/files?per_page=100&page=1": () => [
    {
      filename: "src/auth/x\n::error file=README.md::forged by the pull request\n.ts",
      status: "added",
      additions: 1,
      deletions: 0,
      patch: "+export {};"
    }
  ],
  // Pull request 25 adds a dependency without updating the lockfile that exists on its base.
  "GET /repos/acme/widgets/pulls/25/files?per_page=100&page=1": () => [
    {
      filename: "package.json",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   "dependencies": {\n+    "axios": "^1.6.0",\n     "yaml": "^2.8.0"'
    }
  ],
  [`GET /repos/acme/widgets/contents?ref=${fakeLockfileBaseSha}`]: () => [
    { name: "package-lock.json", type: "file" },
    { name: "src", type: "dir" }
  ],
  "GET /repos/acme/widgets/issues/25/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/25/comments": () => ({ id: 40 }),
  // CODEOWNERS on pull request 23's base names the owners of the billing code.
  [`GET /repos/acme/widgets/contents/.github/CODEOWNERS?ref=${fakeComparisonBaseSha}`]: () =>
    fileContent("* @acme/maintainers\nsrc/billing/ @acme/payments\n"),
  // On the append base, the CODEOWNERS path is a directory, which cannot be read.
  [`GET /repos/acme/widgets/contents/.github/CODEOWNERS?ref=${fakeAppendBaseSha}`]: () => [{ type: "file", name: "README" }],
  // Pull request 23's review comment recorded one finding that is still reported and one that is not.
  [`GET /repos/acme/widgets/contents/.gitattributes?ref=${fakeComparisonBaseSha}`]: () =>
    fileContent("# Generated clients\nsrc/gen/** linguist-generated\n"),
  "GET /repos/acme/widgets/pulls/23/files?per_page=100&page=1": () => [
    { filename: "src/billing/charge.ts", status: "modified", additions: 1, deletions: 0, patch: "+export {};" },
    // Marked generated in .gitattributes on the base commit, so its eval is not reported.
    {
      filename: "src/gen/client.ts",
      status: "added",
      additions: 1,
      deletions: 0,
      patch: `+export const run = (code: string) => ${["ev", "al"].join("")}(code);`
    }
  ],
  "GET /repos/acme/widgets/issues/23/comments?per_page=100&page=1": () => [
    {
      id: 30,
      user: { login: "github-actions[bot]", type: "Bot" },
      body: [
        marker,
        "",
        "previous review",
        renderState([
          { ruleId: "missing-tests", title: "Source changed without tests", severity: "warning", message: "" },
          { ruleId: "secret-in-diff", title: "Secret added", severity: "high", file: "src/config.ts", message: "" }
        ])
      ].join("\n")
    }
  ],
  "PATCH /repos/acme/widgets/issues/comments/30": () => ({ id: 30 }),
  "GET /repos/acme/widgets/issues/7/comments?per_page=100&page=1": () => [
    { id: 5, user: { login: "github-actions[bot]", type: "Bot" }, body: `${marker}\n\nprevious review` },
    { id: 6, user: { login: "octocat", type: "User" }, body: `${marker}\n\nnot a real review` }
  ],
  "POST /repos/acme/widgets/issues/7/comments": () => ({ id: 8 }),
  "GET /repos/acme/widgets/issues/11/comments?per_page=100&page=1": () => [],
  "POST /repos/acme/widgets/issues/11/comments": () => ({ id: 12 }),
  "PATCH /repos/acme/widgets/issues/comments/5": () => ({ id: 5 })
};

// Pull request 17 fills every page GitHub lists, as a pull request with more than 3000 files does.
for (let page = 1; page <= 30; page += 1) {
  routes[`GET /repos/acme/widgets/pulls/17/files?per_page=100&page=${page}`] = () =>
    Array.from({ length: 100 }, (_, index) => ({
      filename: `docs/page-${page}-${index}.md`,
      status: "modified",
      additions: 1,
      deletions: 0
    }));
}

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

  // A route can answer with an error status by returning { status, body }.
  const result = route(body);
  if (result instanceof ErrorResponse) {
    return new Response(JSON.stringify(result.body), { status: result.status });
  }

  return new Response(JSON.stringify(result), { status: 200 });
}) as typeof fetch;
