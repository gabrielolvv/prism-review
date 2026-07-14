import { PRISM_COMMENT_MARKER } from "../reporting/render-markdown.js";
export async function upsertPullRequestComment(client, owner, repo, issueNumber, body) {
    const comments = await client.paginate(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
    const existing = comments.find((comment) => comment.body?.includes(PRISM_COMMENT_MARKER));
    if (existing) {
        await client.request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
            method: "PATCH",
            body: { body }
        });
        return;
    }
    await client.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
        method: "POST",
        body: { body }
    });
}
