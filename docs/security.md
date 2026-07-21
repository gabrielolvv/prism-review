# Security

Prism Review treats pull request content as untrusted input.

## Current Boundaries

- Repository code is not executed.
- GitHub token permissions are intentionally narrow.
- Review comments are upserted through a stable marker to avoid comment spam.
- Oversized patches are dropped before any pattern matching runs.
- Patch content is redacted before analysis entrypoints use it.
- GitHub API requests are bounded in time, page count, and error output.
- The action runs from a committed bundle and installs nothing at runtime.
- AI review is not part of the deterministic core.

## Patch Size Limits

Every changed file passes through a size check before redaction. A patch above `security.maxPatchBytes` is removed from the file entry, which is then marked as omitted and reported by the `oversized-patch` rule.

The limit runs first on purpose: redaction is regex-based, so it should never scan input of unbounded size.

## Secret Redaction

Diffs may accidentally include credentials. Prism Review redacts common token-like values before they are passed into review flows.

The redactor currently masks:

- Assignment-style secrets such as `OPENAI_API_KEY=...`
- GitHub tokens
- OpenAI-style API keys
- AWS access key IDs
- Long base64-like token values

The redactor returns new changed-file objects instead of mutating the originals, which keeps the analysis pipeline easier to reason about and test.

### Allowlist

The long-token pattern also matches harmless values such as 40-character commit hashes. `security.redaction.allowlist` keeps those readable. Patterns are tested against one candidate value at a time, so allowlisting a commit hash does not protect a token that appears on the same line.

## GitHub API Client

- Requests time out after 15 seconds.
- Pagination stops after 30 pages of 100 items, which matches the 3000-file cap of the pull request files endpoint.
- Error response bodies are truncated to 300 characters before they are included in error messages.

## Known Limitations

- Configuration is read from the pull request checkout, so a pull request can change the rules that review it. Treat a change to `.prism-review.yml` as a sensitive change.
- Allowlist patterns are regular expressions supplied by the repository. A pathological pattern can slow the run down; the job timeout is the backstop.

## Future Hardening

- Add prompt injection fixtures before AI review.
- Load configuration from the base branch.
- Flag changes to `.prism-review.yml` as sensitive by default.
