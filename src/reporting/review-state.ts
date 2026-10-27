import { createHash } from "node:crypto";
import type { Finding } from "../analysis/finding.js";

// The review comment records which findings it reported, so the next run can tell what is new and
// what is no longer reported. Each finding is kept as its rule id and a short hash of its file and
// title: line numbers move between pushes, and the hash keeps file names, which the pull request
// controls, out of the hidden record.
export const STATE_MARKER = "prism-review-state";

// Past this many findings the record would crowd the comment's size limit, so it only says it is
// incomplete and the next run does not compare.
const maxRecorded = 400;
const hashPattern = /^[0-9a-f]{12}$/;
const rulePattern = /^[a-z0-9-]{1,64}$/;

export type PreviousFindings = ReadonlyMap<string, number>;

export function fingerprint(finding: Finding): string {
  const hash = createHash("sha256").update(JSON.stringify([finding.file ?? "", finding.title])).digest("hex");
  return `${finding.ruleId}:${hash.slice(0, 12)}`;
}

export function renderState(findings: Finding[]): string {
  if (findings.length > maxRecorded) {
    return `<!-- ${STATE_MARKER} v1 incomplete -->`;
  }

  const byRule = new Map<string, string[]>();
  for (const finding of findings) {
    const [ruleId = "", hash = ""] = fingerprint(finding).split(":");
    // Only rule ids that cannot end the HTML comment are recorded.
    if (rulePattern.test(ruleId)) {
      byRule.set(ruleId, [...(byRule.get(ruleId) ?? []), hash]);
    }
  }
  const entries = [...byRule].map(([ruleId, hashes]) => `${ruleId}:${hashes.join(",")}`);
  return `<!-- ${STATE_MARKER} v1${entries.map((entry) => ` ${entry}`).join("")} -->`;
}

// Counts of each fingerprint in a previous review comment, or undefined when it has no complete
// record, such as a comment from an older version. Anything malformed is not trusted at all.
export function readState(body: string): PreviousFindings | undefined {
  // The record is the comment's last line. File names elsewhere in the comment could spell out a
  // record, but their newlines are escaped, so none of them can be the last line.
  const text = body.trimEnd();
  const lastLine = text.slice(text.lastIndexOf("\n") + 1);
  const match = new RegExp(`^<!-- ${STATE_MARKER} v1((?: [^ ]{1,20000}){0,100}) -->$`).exec(lastLine);
  if (match === null) {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const entry of (match[1] ?? "").split(" ").filter(Boolean)) {
    const [ruleId = "", hashes = "", ...rest] = entry.split(":");
    const list = hashes.split(",");
    if (rest.length > 0 || !rulePattern.test(ruleId) || !list.every((hash) => hashPattern.test(hash))) {
      return undefined;
    }
    for (const hash of list) {
      const key = `${ruleId}:${hash}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export type Comparison = {
  isNew: (finding: Finding) => boolean;
  newCount: number;
  // Rule ids with how many of their findings are no longer reported, most first.
  noLongerReported: Array<[string, number]>;
};

// Matches findings one to one, so a second finding with the same fingerprint is still new.
export function compareWithPrevious(findings: Finding[], previous: PreviousFindings): Comparison {
  const remaining = new Map(previous);
  const fresh = new Set<Finding>();

  for (const finding of findings) {
    const key = fingerprint(finding);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else {
      fresh.add(finding);
    }
  }

  const gone = new Map<string, number>();
  for (const [key, count] of remaining) {
    if (count > 0) {
      const ruleId = key.split(":")[0] ?? "";
      gone.set(ruleId, (gone.get(ruleId) ?? 0) + count);
    }
  }

  return {
    isNew: (finding) => fresh.has(finding),
    newCount: fresh.size,
    noLongerReported: [...gone].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  };
}
