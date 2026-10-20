import type { ChangedFile, FileStatus } from "../analysis/changed-file.js";

const BACKSLASH = 92;
const QUOTE = 34;

// Parses `git diff` output. git quotes paths that contain non-ASCII bytes or special characters
// and may use `i/` and `w/` prefixes (diff.mnemonicPrefix) or none (diff.noprefix). A section
// whose paths cannot be read raises an error rather than being skipped, so a review never passes
// because a file was silently left out.
export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const sections = diff.split(/^diff --git /m).slice(1);

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const header = lines[0] ?? "";
    const headerPaths = readHeaderPaths(header);
    if (!headerPaths) {
      throw new Error(`Unrecognized diff header: diff --git ${header}`);
    }

    const prefixed = hasPrefixes(headerPaths);
    const strip = (path: string) => (prefixed ? path.slice(2) : path);
    const status = detectStatus(lines);
    const oldPath = readMarkerPath(lines, "--- ", strip) ?? readRenamePath(lines, "rename from ") ?? strip(headerPaths[0]);
    const path = readMarkerPath(lines, "+++ ", strip) ?? readRenamePath(lines, "rename to ") ?? strip(headerPaths[1]);
    const patch = `diff --git ${section}`.trimEnd();
    const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;

    files.push({
      path,
      ...(status === "renamed" ? { previousPath: oldPath } : {}),
      status,
      additions,
      deletions,
      patch
    });
  }

  return files;
}

// Prefixed headers use two different single-letter prefixes, such as a/ and b/ or i/ and w/.
function hasPrefixes([oldPath, newPath]: [string, string]): boolean {
  const prefix = /^[a-z]\//;
  return prefix.test(oldPath) && prefix.test(newPath) && oldPath[0] !== newPath[0];
}

function readHeaderPaths(header: string): [string, string] | undefined {
  if (header.charCodeAt(0) === QUOTE) {
    const first = readQuoted(header, 0);
    if (!first) {
      return undefined;
    }

    const rest = header.slice(first.end).trimStart();
    const second = rest.charCodeAt(0) === QUOTE ? readQuoted(rest, 0)?.value : rest;
    return second ? [first.value, second] : undefined;
  }

  const quotedSecond = header.indexOf(' "');
  if (quotedSecond > 0) {
    const second = readQuoted(header, quotedSecond + 1);
    return second ? [header.slice(0, quotedSecond), second.value] : undefined;
  }

  const prefixed = /^([a-z]\/.+?) ([a-z]\/.+)$/.exec(header);
  if (prefixed?.[1] && prefixed[2] && prefixed[1][0] !== prefixed[2][0]) {
    return [prefixed[1], prefixed[2]];
  }

  // Without prefixes, an unrenamed file's header is the same path twice.
  const half = (header.length - 1) / 2;
  if (Number.isInteger(half) && header[half] === " " && header.slice(0, half) === header.slice(half + 1)) {
    return [header.slice(0, half), header.slice(half + 1)];
  }

  return undefined;
}

function readMarkerPath(lines: string[], marker: string, strip: (path: string) => string): string | undefined {
  const line = lines.find((candidate) => candidate.startsWith(marker));
  if (!line) {
    return undefined;
  }

  const raw = line.slice(marker.length);
  const value = raw.charCodeAt(0) === QUOTE ? readQuoted(raw, 0)?.value : raw.split("\t")[0];
  return value === undefined || value === "/dev/null" ? undefined : strip(value);
}

function readRenamePath(lines: string[], marker: string): string | undefined {
  const raw = lines.find((line) => line.startsWith(marker))?.slice(marker.length);
  if (raw === undefined) {
    return undefined;
  }

  return raw.charCodeAt(0) === QUOTE ? readQuoted(raw, 0)?.value : raw;
}

// Reads a C-style quoted string as git writes it, decoding octal byte escapes as UTF-8.
function readQuoted(text: string, start: number): { value: string; end: number } | undefined {
  const bytes: number[] = [];
  const named: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };

  for (let index = start + 1; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === QUOTE) {
      return { value: Buffer.from(bytes).toString("utf8"), end: index + 1 };
    }

    if (code !== BACKSLASH) {
      bytes.push(...Buffer.from(text[index] ?? "", "utf8"));
      continue;
    }

    const next = text[index + 1] ?? "";
    const octal = /^[0-7]{3}/.exec(text.slice(index + 1, index + 4));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += 3;
    } else if (next in named) {
      bytes.push(named[next] ?? 0);
      index += 1;
    } else {
      bytes.push(next.charCodeAt(0));
      index += 1;
    }
  }

  return undefined;
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
