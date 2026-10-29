import type { GitHubClient } from "./client.js";
import { fetchRepositoryFile } from "./fetch-repository-file.js";
import { resolveConfig } from "../config/extends.js";
import type { PrismConfig } from "../config/schema.js";

// Reading the base commit keeps a pull request from relaxing the rules that review it. A file it
// extends in the same repository is read from the base commit too; one in another repository is read
// at the ref the configuration names, with the action's token.
export async function loadBaseBranchConfig(
  client: GitHubClient,
  owner: string,
  repo: string,
  configPath: string,
  baseSha: string
): Promise<{ config: PrismConfig; extendedPaths: string[] } | undefined> {
  const raw = await fetchRepositoryFile(client, owner, repo, configPath, baseSha);
  if (raw === undefined) {
    return undefined;
  }

  return resolveConfig(raw, `${configPath} at ${baseSha.slice(0, 7)}`, async (target) => {
    const file =
      target.kind === "local"
        ? await fetchRepositoryFile(client, owner, repo, target.path, baseSha)
        : await fetchRepositoryFile(client, target.owner, target.repo, target.path, target.ref);
    const source =
      target.kind === "local" ? `${target.path} at ${baseSha.slice(0, 7)}` : `${target.owner}/${target.repo}/${target.path}@${target.ref}`;
    return file === undefined ? undefined : { raw: file, source };
  }, configPath);
}
