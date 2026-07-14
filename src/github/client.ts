export type GitHubClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  paginate<T>(path: string): Promise<T[]>;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

const githubApiBaseUrl = "https://api.github.com";

export function createGitHubClient(token: string): GitHubClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${githubApiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`GitHub API request failed: ${response.status} ${details}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async function paginate<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let page = 1;

    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = await request<T[]>(`${path}${separator}per_page=100&page=${page}`);
      items.push(...batch);

      if (batch.length < 100) {
        return items;
      }

      page += 1;
    }
  }

  return { request, paginate };
}
