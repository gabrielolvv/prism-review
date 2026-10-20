export type AddedLine = {
  line: number;
  content: string;
};

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export type PatchLine = AddedLine & {
  added: boolean;
  // True for the first line of each hunk, where any state carried from earlier lines is unknown.
  startsHunk: boolean;
};

// Returns the new version's lines that the patch shows, context and added, numbered as in the new
// file. Removed lines are left out.
export function patchLines(patch: string): PatchLine[] {
  const lines: PatchLine[] = [];
  let newLine: number | undefined;
  let startsHunk = false;

  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      newLine = Number(header[1]);
      startsHunk = true;
      continue;
    }

    // Lines before the first hunk are git headers such as `+++ b/path`.
    if (newLine === undefined || line.startsWith("\\") || line.startsWith("-")) {
      continue;
    }

    lines.push({ line: newLine, content: line.slice(1), added: line.startsWith("+"), startsHunk });
    startsHunk = false;
    newLine += 1;
  }

  return lines;
}

// Returns the lines a patch adds, numbered as in the new version of the file.
export function addedLines(patch: string): AddedLine[] {
  return patchLines(patch)
    .filter((line) => line.added)
    .map(({ line, content }) => ({ line, content }));
}

export type LineMatch<Label> = {
  line: number;
  label: Label;
};

// Tests every added line against labelled patterns. Lines matching `ignoreLine` are skipped whole,
// which lets a rule leave out definitions that share a name with the calls it looks for.
export function matchAddedLines<Label>(
  patch: string,
  patterns: Array<[Label, RegExp]>,
  ignoreLine?: RegExp
): Array<LineMatch<Label>> {
  return addedLines(patch).flatMap(({ line, content }) =>
    ignoreLine?.test(content)
      ? []
      : patterns.filter(([, pattern]) => pattern.test(content)).map(([label]) => ({ line, label }))
  );
}
