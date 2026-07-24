import type { ChangedFile, FileStatus } from "../analysis/changed-file.js";

export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const sections = diff.split(/^diff --git /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const header = lines[0] ?? "";
    const match = header.match(/^a\/(.+?) b\/(.+)$/);
    if (!match) {
      continue;
    }

    const path = match[2];
    const status = detectStatus(lines);
    const previousPath = status === "renamed" ? readRenameSource(lines) : undefined;
    const patch = `diff --git ${section}`.trimEnd();
    const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;

    files.push({
      path,
      ...(previousPath ? { previousPath } : {}),
      status,
      additions,
      deletions,
      patch
    });
  }

  return files;
}

function readRenameSource(lines: string[]): string | undefined {
  return lines.find((line) => line.startsWith("rename from "))?.slice("rename from ".length);
}

function detectStatus(lines: string[]): FileStatus {
  if (lines.some((line) => line.startsWith("new file mode"))) {
    return "added";
  }

  if (lines.some((line) => line.startsWith("deleted file mode"))) {
    return "removed";
  }

  if (lines.some((line) => line.startsWith("rename from "))) {
    return "renamed";
  }

  return "modified";
}
