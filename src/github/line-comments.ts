import type { Finding } from "../analysis/finding.js";
import { LINE_COMMENT_MARKER, renderLineComment } from "../reporting/render-markdown.js";
import { GitHubApiError, type GitHubClient } from "./client.js";

export type ExistingLineComment = {
  id: number;
  path: string;
  // Null once the comment is outdated, because its line is no longer in the diff.
  line: number | null;
  body?: string;
  user?: { type?: string };
};

export type LineCommentPlan = {
  create: Array<{ path: string; line: number; body: string }>;
  update: Array<{ id: number; body: string }>;
  resolve: Array<{ id: number; body: string }>;
  // Findings left out by maxComments.
  skipped: number;
};

export type LineCommentOptions = { includeLowSeverity: boolean; maxComments: number };

const markerPattern = new RegExp(`^<!-- ${LINE_COMMENT_MARKER} ([\\w-]+)( resolved)? -->`);

// Decides which review comments to create, update, or mark resolved. Comments are never deleted,
// so replies people wrote under them stay. Findings are sorted by severity, so the cap keeps the
// most important ones.
export function planLineComments(
  findings: Finding[],
  existing: ExistingLineComment[],
  options: LineCommentOptions
): LineCommentPlan {
  const eligible = findings.filter(
    (finding): finding is Finding & { file: string; line: number } =>
      finding.file !== undefined && finding.line !== undefined && (options.includeLowSeverity || finding.severity !== "info")
  );
  const wanted = eligible.slice(0, options.maxComments);

  // Anyone can paste the marker, so only bot comments that start with it are ours.
  const ours = existing.flatMap((comment) => {
    const marker = comment.user?.type === "Bot" ? markerPattern.exec(comment.body ?? "") : null;
    return marker ? [{ ...comment, ruleId: marker[1] ?? "", resolved: marker[2] !== undefined }] : [];
  });
  const byKey = new Map(
    ours.filter((comment) => comment.line !== null).map((comment) => [key(comment.ruleId, comment.path, comment.line ?? 0), comment])
  );

  const plan: LineCommentPlan = { create: [], update: [], resolve: [], skipped: eligible.length - wanted.length };
  const matched = new Set<number>();
  for (const finding of wanted) {
    const body = renderLineComment(finding);
    const comment = byKey.get(key(finding.ruleId, finding.file, finding.line));
    if (comment === undefined) {
      plan.create.push({ path: finding.file, line: finding.line, body });
      continue;
    }
    matched.add(comment.id);
    if (comment.body !== body) {
      plan.update.push({ id: comment.id, body });
    }
  }

  for (const comment of ours) {
    if (!matched.has(comment.id) && !comment.resolved) {
      plan.resolve.push({
        id: comment.id,
        body: `<!-- ${LINE_COMMENT_MARKER} ${comment.ruleId} resolved -->\nThis finding is no longer reported on the latest commit.`
      });
    }
  }

  return plan;
}

export type LineCommentResult = { created: number; updated: number; resolved: number; rejected: number; skipped: number };

export async function syncLineComments(
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  findings: Finding[],
  options: LineCommentOptions
): Promise<LineCommentResult> {
  const existing = await client.paginate<ExistingLineComment>(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments`);
  const plan = planLineComments(findings, existing, options);
  const result: LineCommentResult = { created: 0, updated: 0, resolved: 0, rejected: 0, skipped: plan.skipped };

  for (const comment of plan.create) {
    try {
      await client.request(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments`, {
        method: "POST",
        body: { body: comment.body, commit_id: headSha, path: comment.path, line: comment.line, side: "RIGHT" }
      });
      result.created += 1;
    } catch (error) {
      // GitHub only accepts lines inside the diff; the summary comment still lists the finding.
      if (!(error instanceof GitHubApiError) || error.status !== 422) {
        throw error;
      }
      result.rejected += 1;
    }
  }
  for (const [list, field] of [
    [plan.update, "updated"],
    [plan.resolve, "resolved"]
  ] as const) {
    for (const comment of list) {
      await client.request(`/repos/${owner}/${repo}/pulls/comments/${comment.id}`, {
        method: "PATCH",
        body: { body: comment.body }
      });
      result[field] += 1;
    }
  }

  return result;
}

function key(ruleId: string, path: string, line: number): string {
  return `${ruleId}\n${path}\n${line}`;
}
