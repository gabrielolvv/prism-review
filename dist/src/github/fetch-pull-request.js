export async function fetchPullRequestFiles(client, owner, repo, pullNumber) {
    const files = await client.paginate(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
    return files.map((file) => ({
        path: file.filename,
        status: normalizeStatus(file.status),
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch
    }));
}
function normalizeStatus(status) {
    if (status === "added" || status === "removed" || status === "renamed") {
        return status;
    }
    return "modified";
}
