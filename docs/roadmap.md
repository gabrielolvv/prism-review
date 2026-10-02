# Roadmap

This roadmap is intentionally staged so the project grows like a real developer tool: deterministic review first, safety controls second, optional AI last.

## Shipped

- Dependency risk rule for manifests and lockfiles across Node.js, Python, Go, and Rust.
- Secret redaction before patch content reaches any review flow.
- Redaction allowlist for known false positives.
- Patch size limits with an `oversized-patch` finding.
- Self-contained action bundle, so the runner never installs dependencies.
- Mocked `fetch` coverage for the GitHub client, pagination, and comment upserts.
- Configuration loaded from the pull request base commit.
- `config-change` rule for any change to the review configuration.
- `append` comment mode.
- End-to-end smoke test of the bundled action in CI.
- GitHub Enterprise Server support through `GITHUB_API_URL`.
- Opt-in inline annotations through workflow commands, with no extra permission.
- `secret-in-diff` rule with line-level findings for credentials added in the diff.

## Near Term

### Add prompt-injection fixtures

Add diff fixtures that contain instructions aimed at a reviewer model, so any future AI layer is tested against hostile pull request content from day one.

### Add more line-level findings

`secret-in-diff` reports the line it found. Other rules that inspect patch content, such as risky API calls or disabled tests, can reuse its hunk line numbering so their annotations land on the changed line.

## Mid Term

### Add optional AI review summaries

Add provider interfaces, prompt construction, schema validation, and graceful fallback. AI output must remain advisory and grounded in redacted diff snippets.

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
