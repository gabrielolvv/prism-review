export type GitHubClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  paginate<T>(path: string): Promise<T[]>;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    details: string
  ) {
    super(`GitHub API request failed: ${status} ${details}`);
    this.name = "GitHubApiError";
  }
}

export const defaultGitHubApiUrl = "https://api.github.com";
const requestTimeoutMs = 15_000;
const pageSize = 100;
// GitHub caps pull request file listings at 3000 entries.
const maxPages = 30;
const maxErrorDetailLength = 300;

export function createGitHubClient(
  token: string,
  apiUrl: string = defaultGitHubApiUrl
): GitHubClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        truncate(await response.text(), maxErrorDetailLength)
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async function paginate<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const separator = path.includes("?") ? "&" : "?";

    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await request<T[]>(`${path}${separator}per_page=${pageSize}&page=${page}`);
      items.push(...batch);

      if (batch.length < pageSize) {
        break;
      }
    }

    return items;
  }

  return { request, paginate };
}

// The runner sets GITHUB_API_URL, which points at the GitHub Enterprise Server API on GHES.
export function resolveGitHubApiUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return defaultGitHubApiUrl;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }

  if (url.search || url.hash || url.username || url.password) {
    throw new Error(`Invalid GITHUB_API_URL value: ${trimmed}`);
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
