import { GitHubApiError, type GitHubClient } from "./client.js";

type GitHubContent = {
  type?: string;
  encoding?: string;
  content?: string;
};

export async function fetchRepositoryFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | undefined> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  let content: GitHubContent | GitHubContent[];

  try {
    content = await client.request<GitHubContent | GitHubContent[]>(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return undefined;
    }

    throw error;
  }

  if (Array.isArray(content) || content.type !== "file") {
    throw new Error(`${path} is not a file at ${ref}.`);
  }

  // Files above 1 MB come back without inline content.
  if (content.encoding !== "base64" || content.content === undefined) {
    throw new Error(`${path} at ${ref} is too large to read through the contents API.`);
  }

  return Buffer.from(content.content, "base64").toString("utf8");
}
