# Roadmap

This roadmap is intentionally staged so the project grows like a real developer tool: deterministic review first, safety controls second, optional AI last.

## Shipped

- Dependency risk rule for manifests and lockfiles across Node.js, Python, Go, and Rust.
- Secret redaction before patch content reaches any review flow.
- Redaction allowlist for known false positives.
- Patch size limits with an `oversized-patch` finding.
- Self-contained action bundle, so the runner never installs dependencies.
- Mocked `fetch` coverage for the GitHub client, pagination, and comment upserts.

## Near Term

### Add prompt-injection fixtures

Add diff fixtures that contain instructions aimed at a reviewer model, so any future AI layer is tested against hostile pull request content from day one.

### Add inline PR annotations

Support optional GitHub Checks annotations so findings can appear beside changed files while preserving the summary comment.

### Load configuration from the base branch

The action currently reads `.prism-review.yml` from the checked-out pull request. Reading it from the base branch would stop a pull request from relaxing its own review rules.

## Mid Term

### Add optional AI review summaries

Add provider interfaces, prompt construction, schema validation, and graceful fallback. AI output must remain advisory and grounded in redacted diff snippets.

### Implement `append` comment mode

The schema accepts `comment.mode: append`, but only `upsert` is implemented.

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
