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
- `skipped-tests` rule for focused and skipped tests across JavaScript, Python, Go, and Rust.
- `blanket-suppression` rule for lint and type check suppressions that name no rule.
- `risky-api` rule for added calls that run code, start a shell, deserialize data, or write raw HTML.
- `check.failOn` to fail the job, so branch protection can require the review.

## Near Term

### Add prompt-injection fixtures

Add diff fixtures that contain instructions aimed at a reviewer model, so any future AI layer is tested against hostile pull request content from day one.

### Add more languages to line-level rules

`secret-in-diff`, `skipped-tests`, `blanket-suppression`, and `risky-api` report the line they found. Ruby, Java, and PHP equivalents of their patterns can reuse `addedLines` and the same tests.

## Mid Term

### Add optional AI review summaries

Add provider interfaces, prompt construction, schema validation, and graceful fallback. AI output must remain advisory and grounded in redacted diff snippets.

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
