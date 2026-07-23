import type { GitHubClient } from "./client.js";
import { fetchRepositoryFile } from "./fetch-repository-file.js";
import { parseConfig } from "../config/load-config.js";
import type { PrismConfig } from "../config/schema.js";

// Reading the base commit keeps a pull request from relaxing the rules that review it.
export async function loadBaseBranchConfig(
  client: GitHubClient,
  owner: string,
  repo: string,
  configPath: string,
  baseSha: string
): Promise<PrismConfig | undefined> {
  const raw = await fetchRepositoryFile(client, owner, repo, configPath, baseSha);
  if (raw === undefined) {
    return undefined;
  }

  return parseConfig(raw, `${configPath} at ${baseSha.slice(0, 7)}`);
}
