# Roadmap

This roadmap is intentionally staged so the project grows like a real developer tool: deterministic review first, safety controls second, optional AI last.

## Near Term

### Add dependency risk rule

Detect changes to dependency manifests and lockfiles, then ask reviewers to verify package provenance, lockfile consistency, runtime impact, and supply-chain risk.

Target files:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `requirements.txt`
- `pyproject.toml`
- `go.mod`
- `Cargo.toml`

### Add secret redaction before publishing review comments

Redact token-like values from patches before any future feature uses diff content in logs, comments, or AI prompts.

### Add inline PR annotations

Support optional GitHub Checks annotations so findings can appear beside changed files while preserving the summary comment.

## Mid Term

### Add optional AI review summaries

Add provider interfaces, prompt construction, schema validation, and graceful fallback. AI output must remain advisory and grounded in redacted diff snippets.

### Add integration tests for the GitHub API client

Cover pagination, comment creation, comment updates, and API failure handling with mocked `fetch`.

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
