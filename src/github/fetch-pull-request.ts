import type { GitHubClient } from "./client.js";
import type { ChangedFile, FileStatus } from "../analysis/changed-file.js";

type GitHubPullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export async function fetchPullRequestFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<ChangedFile[]> {
  const files = await client.paginate<GitHubPullFile>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/files`
  );

  return files.map((file) => ({
    path: file.filename,
    status: normalizeStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch
  }));
}

function normalizeStatus(status: string): FileStatus {
  if (status === "added" || status === "removed" || status === "renamed") {
    return status;
  }

  return "modified";
}
