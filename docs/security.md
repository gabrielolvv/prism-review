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

## Hidden Characters

Pull request content can contain characters a reviewer cannot see. The `hidden-unicode` rule reports bidirectional controls and invisible characters on added lines and in file names, and the comment renders hidden characters in file names as `\u{...}` escapes, so a name such as `invoice<U+202E>fdp.exe` cannot pass for `invoiceexe.pdf`.

`fixtures/diffs/prompt-injection.diff` holds instructions aimed at an AI reviewer, such as "ignore all previous instructions" and a forged review header. A unit test checks that the review of that diff is unchanged and that none of the text reaches the comment. Any future AI layer should be tested against the same fixture.

## Ignored Paths

`ignorePaths` keeps generated and vendored files out of the noise rules. It cannot hide `secret-in-diff`, `credential-file`, `lockfile-source`, `hidden-unicode`, `workflow-risk`, `unpinned-action`, `incomplete-review`, or `config-change` findings, which read every changed file, and it is read from the base commit, so a pull request cannot add its own files to it. A file renamed into an ignored path is still reviewed unless its old path was ignored too.

The `severity` setting can lower or turn off any rule, the security rules included. That is a deliberate choice for maintainers, and the pull request that makes it is reviewed with the previous configuration, where `config-change` reports it as high risk.

## Inline Suppressions

A `prism-review-ignore` comment is written by the pull request it affects, so it is limited on purpose. It needs a reason, it only covers the lines it names, and it cannot suppress the rules `ignorePaths` cannot hide, which are the ones that guard secrets, workflows, dependencies, and the configuration. Every suppressed finding is still listed in the review with its reason, so a reviewer sees what was acknowledged and why.

## Pull Requests From Forks

GitHub runs `pull_request` workflows for forks with a read-only token, so the comment cannot be posted. The action logs a warning and keeps the review in the job summary instead of failing only when all of these hold: the event is `pull_request`, the head repository is a different one (or was deleted), and the comment request returned 403 without a rate-limit message. Any other 403 still fails the run: on the repository's own pull requests it means the workflow lacks `pull-requests: write`, `pull_request_target` runs have a token that can write, and a rate limit is a real failure. `check.failOn` applies either way.

## Pull Requests Over 3000 Files

GitHub lists at most 3000 files for a pull request. When the list reaches that limit, the `incomplete-review` rule compares it with the `changed_files` count in the event and reports a high-risk finding when files are missing, so a gate fails rather than passing a pull request it could not review in full. A shorter list is not compared, because the count in the event can be out of date after a push.

## Workflow Changes

`sensitive-files` reports any change under `.github/workflows/`. `workflow-risk` adds what to look at: script injection through untrusted contexts in `run` and `script`, `pull_request_target`, checkouts of pull request code, and `write-all` permissions. It checks workflow files even when `ignorePaths` matches them. `unpinned-action` warns about third-party actions and images used by a tag or branch, which their owners can move to other code after review. Branch protection should still require review for workflow changes, because a pull request can edit the workflow that runs Prism Review.

## Lockfile Sources

A lockfile records the URL each package is downloaded from, and an install runs the package's scripts. A pull request can change that URL for a familiar package name, and the change hides in a diff few people read. `lockfile-source` reports URLs outside the allowed registries or over plain HTTP as high risk, and Git sources and extra pip indexes as warnings. It reads patches before the size limit, so a large lockfile update is still checked, and it shows only the host, never a URL that may carry credentials. GitHub sends no patch at all for the largest diffs, so such a lockfile is only covered by `dependency-risk`; the CLI reads the full `git diff` and can check it.

## SARIF Reports

The SARIF report holds the same text as the comment: rule ids, file paths, line numbers, messages, and suppression reasons, never a secret's value. Uploading it to code scanning needs `security-events: write` and a checkout so code scanning can match results to files; the checkout is only read, and Prism Review itself still reads the pull request through the API.

## Merge Gate

`check.failOn` turns the review into a required check. It is read from the base commit like the rest of the configuration, so a pull request cannot lower the threshold for itself; it can only edit the workflow, which `sensitive-files` reports and branch protection should require review for.

## Patch Size Limits

Every changed file passes through a size check before redaction. A patch above `security.maxPatchBytes` is removed from the file entry, which is then marked as omitted and reported by the `oversized-patch` rule.

The limit runs before redaction on purpose: redaction uses broad patterns, so it should never scan input of unbounded size. Secret detection runs before the limit, on the full patch, because a missed credential costs more than the scan. Its patterns are narrow and run in linear time; a unit test feeds them megabytes of near-miss input to keep it that way.

## Secret Redaction

Diffs may accidentally include credentials. Prism Review redacts common token-like values before they are passed into review flows.

The redactor currently masks:

- Assignment-style secrets such as `OPENAI_API_KEY=...`
- GitHub tokens
- OpenAI-style API keys
- AWS access key IDs
- Long base64-like token values

The redactor returns new changed-file objects instead of mutating the originals, which keeps the analysis pipeline easier to reason about and test.

### Secret Detection

Before the size limit and redaction, added lines are checked for credential formats that rarely match anything else: GitHub tokens, OpenAI-style keys, AWS access key IDs, and private key headers, including PGP key blocks. The match is recorded as a line number and a kind, never as the value, and the `secret-in-diff` rule reports it. Detection shares its token patterns with the redactor, so a value that is reported is also masked.

The same step checks `.env`, `.npmrc`, `.yarnrc.yml`, and `.pypirc` files for credential values, before redaction replaces the values that tell a secret from a reference such as `${NPM_TOKEN}`. Only line numbers are kept, and the `credential-file` rule reports them along with committed private keys, key stores, and Terraform state.

A finding means the credential has already been pushed to a branch that others can read. Rotating it matters more than removing it from the pull request.

### Allowlist

The long-token pattern also matches harmless values such as 40-character commit hashes. `security.redaction.allowlist` keeps those readable. The same allowlist stops `secret-in-diff` from reporting a value. Patterns are tested against one candidate value at a time, so allowlisting a commit hash does not protect a token that appears on the same line.

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
