import { GitHubApiError, type GitHubClient } from "./client.js";

type GitHubContent = { name?: string; type?: string };

// The names of the files in a directory at a commit, or none when the directory does not exist.
export async function listDirectoryFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  directory: string,
  ref: string
): Promise<string[]> {
  const encoded = directory.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  let content: GitHubContent | GitHubContent[];
  try {
    content = await client.request<GitHubContent | GitHubContent[]>(
      `/repos/${owner}/${repo}/contents${encoded === "" ? "" : `/${encoded}`}?ref=${encodeURIComponent(ref)}`
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return [];
    }
    throw error;
  }

  return Array.isArray(content)
    ? content.filter((entry) => entry.type === "file" && typeof entry.name === "string").map((entry) => entry.name ?? "")
    : [];
}
