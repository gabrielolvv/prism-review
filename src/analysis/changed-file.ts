import type { HiddenLine } from "./hidden-characters.js";

// GitHub lists at most this many files for a pull request.
export const pullRequestFileLimit = 3000;

export type FileStatus = "added" | "modified" | "removed" | "renamed";

export type ChangedFile = {
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
  patchOmitted?: boolean;
  // Set by prepareChangedFiles, which scans the patch before redaction.
  secrets?: SecretMatch[];
  // Set by prepareChangedFiles before oversized patches are dropped.
  hiddenLines?: HiddenLine[];
  // Set by prepareChangedFiles before redaction, for environment and package manager files.
  credentialLines?: number[];
};

// A credential found on an added line, numbered as in the new version of the file.
export type SecretMatch = {
  line: number;
  kind: string;
};

export function changedLines(file: ChangedFile): number {
  return file.additions + file.deletions;
}
