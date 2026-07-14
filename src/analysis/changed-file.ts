export type FileStatus = "added" | "modified" | "removed" | "renamed";

export type ChangedFile = {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
};

export function changedLines(file: ChangedFile): number {
  return file.additions + file.deletions;
}
