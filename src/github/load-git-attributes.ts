import type { GitHubClient } from "./client.js";
import { fetchRepositoryFile } from "./fetch-repository-file.js";
import { gitAttributesPath, parseGitAttributes, type GeneratedFiles } from "../analysis/git-attributes.js";

// Read from the base commit, like the configuration, so a pull request cannot mark its own files
// as generated to keep them out of the review.
export async function loadBaseGitAttributes(
  client: GitHubClient,
  owner: string,
  repo: string,
  baseSha: string
): Promise<GeneratedFiles | undefined> {
  const text = await fetchRepositoryFile(client, owner, repo, gitAttributesPath, baseSha);
  return text === undefined ? undefined : parseGitAttributes(text);
}
