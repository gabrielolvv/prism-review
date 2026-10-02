# Security

Prism Review treats pull request content as untrusted input.

## Current Boundaries

- Repository code is not executed, and the action does not need a checkout.
- Configuration is read from the base commit, so a pull request cannot relax the rules that review it.
- GitHub token permissions are intentionally narrow.
- In the default `upsert` mode, one review comment is updated through a stable marker to avoid comment spam; `append` posts one comment per run.
- Only a comment posted by a bot and starting with the marker is ever edited, so pasting the marker into a comment cannot redirect the review.
- Annotations escape file paths and messages before printing workflow commands, so a crafted file name cannot start a new command such as `::stop-commands::` or `::add-mask::`.
- File paths in the review comment are shown in code spans with newlines spelled out, and rule messages do not quote them, so a crafted file name cannot add headings, a fake risk level, HTML comments, @mentions, or issue references to the comment. Finding text is escaped as plain Markdown.
- `dry-run` prints the review between `::stop-commands::` markers with a random token, so file names quoted in the review are never read as workflow commands.
- Oversized patches are dropped before any pattern matching runs.
- Patch content is redacted before analysis entrypoints use it.
- GitHub API requests are bounded in time, page count, and error output.
- The action runs from a committed bundle and installs nothing at runtime.
- AI review is not part of the deterministic core.

## Configuration Source

The action fetches `config-path` from the pull request base commit through the contents API. Changes to that file inside the pull request, including adding it, only take effect after they are merged, and the `config-change` rule flags them as high risk so a reviewer checks whether thresholds, patterns, or allowlist entries were relaxed.

`config-path` must be a relative path inside the repository. Absolute paths and `..` segments are rejected before any request is made.

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

- Requests go to the API URL in `GITHUB_API_URL`, which the runner sets to `https://api.github.com` on github.com and to the instance API on GitHub Enterprise Server. When it is unset, `https://api.github.com` is used. Values that are not plain `http` or `https` URLs, or that carry credentials, a query string, or a fragment, fail the run before any request is made.
- Requests time out after 15 seconds.
- Pagination stops after 30 pages of 100 items, which matches the 3000-file cap of the pull request files endpoint.
- Error response bodies are truncated to 300 characters before they are included in error messages.
- Failures raise `GitHubApiError`, which keeps the HTTP status. Only a `404` for the configuration file is treated as "no configuration"; any other failure stops the run.

## Known Limitations

- For `pull_request` events, GitHub runs the workflow definition from the pull request. A pull request that edits the workflow can change the inputs passed to Prism Review or remove the step. Changes under `.github/workflows/` are flagged by `sensitive-files`, and branch protection should require review for them.
- GitHub can answer `404` instead of `403` when a token cannot read a private resource, so a token without `contents: read` may fall back to the defaults. The log line `No <path> on the base branch` makes this visible.
- Allowlist patterns are regular expressions supplied by the repository. A pathological pattern can slow the run down; the job timeout is the backstop.

## Future Hardening

- Add prompt injection fixtures before AI review.
