import type { GitHubClient } from "./client.js";
import { fetchRepositoryFile } from "./fetch-repository-file.js";
import { codeOwnersPaths, parseCodeOwners, type CodeOwners } from "../analysis/code-owners.js";

// Read from the base commit, like the configuration, so a pull request cannot name its own owners.
export async function loadBaseCodeOwners(
  client: GitHubClient,
  owner: string,
  repo: string,
  baseSha: string
): Promise<CodeOwners | undefined> {
  for (const path of codeOwnersPaths) {
    const text = await fetchRepositoryFile(client, owner, repo, path, baseSha);
    if (text !== undefined) {
      return parseCodeOwners(text);
    }
  }
  return undefined;
}
