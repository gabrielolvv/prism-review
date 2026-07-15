# Security

Prism Review treats pull request content as untrusted input.

## Current Boundaries

- Repository code is not executed.
- GitHub token permissions are intentionally narrow.
- Review comments are upserted through a stable marker to avoid comment spam.
- Patch content is redacted before analysis entrypoints use it.
- AI review is not part of the deterministic core.

## Secret Redaction

Diffs may accidentally include credentials. Prism Review redacts common token-like values before they are passed into review flows.

The redactor currently masks:

- Assignment-style secrets such as `OPENAI_API_KEY=...`
- GitHub tokens
- OpenAI-style API keys
- AWS access key IDs
- Long base64-like token values

The redactor returns new changed-file objects instead of mutating the originals, which keeps the analysis pipeline easier to reason about and test.

## Future Hardening

- Add prompt injection fixtures before AI review.
- Add optional allowlists for false positives.
- Add integration tests for GitHub API failures.
- Add size limits for very large patches.
