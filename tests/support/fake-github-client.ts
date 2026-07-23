import type { GitHubClient } from "../../src/github/client.js";

export type FakeCall = {
  path: string;
  method: string;
  body?: unknown;
};

// `responses` maps request paths to results; an Error value is thrown instead.
export function createFakeGitHubClient(
  pages: Record<string, unknown[]>,
  responses: Record<string, unknown> = {}
): {
  client: GitHubClient;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];

  const client: GitHubClient = {
    async request<T>(path: string, options: { method?: string; body?: unknown } = {}) {
      calls.push({ path, method: options.method ?? "GET", body: options.body });
      const response = responses[path];
      if (response instanceof Error) {
        throw response;
      }

      return response as T;
    },
    async paginate<T>(path: string) {
      calls.push({ path, method: "GET" });
      return (pages[path] ?? []) as T[];
    }
  };

  return { client, calls };
}
