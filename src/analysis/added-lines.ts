export type AddedLine = {
  line: number;
  content: string;
};

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// Returns the lines a patch adds, numbered as in the new version of the file.
export function addedLines(patch: string): AddedLine[] {
  const added: AddedLine[] = [];
  let newLine: number | undefined;

  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      newLine = Number(header[1]);
      continue;
    }

    // Lines before the first hunk are git headers such as `+++ b/path`.
    if (newLine === undefined || line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+")) {
      added.push({ line: newLine, content: line.slice(1) });
    }

    if (!line.startsWith("-")) {
      newLine += 1;
    }
  }

  return added;
}
