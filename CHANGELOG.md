# Changelog

All notable changes to Prism Review are documented in this file.

## 0.4.0 - 2026-10-20

### Added

- `secret-in-diff` rule reports a high-risk finding, with the line number, when an added line contains a GitHub token, an OpenAI-style key, an AWS access key ID, or a private key header, including PGP key blocks. Patches over `security.maxPatchBytes` are still scanned. The value is redacted everywhere; `security.redaction.allowlist` exempts known test values, and `rules.secretInDiff.enabled` turns the rule off.
- `skipped-tests` rule warns, with the line number, when a pull request adds a focused or skipped test in a file matched by `rules.missingTests.testGlobs`. It recognizes Jest, Vitest, Mocha, Jasmine, and `node:test` markers, pytest and unittest skips including `skipif`, Go `.Skip` calls, and Rust `#[ignore]` in any `.rs` file. `rules.skippedTests.enabled` turns it off.
- The review comment shows the line number next to the file when a finding has one.
- `annotations.enabled` prints findings that name a file as workflow command annotations, so they appear beside the file in the pull request diff without the `checks: write` permission. `annotations.includeLowSeverity` adds `info` findings as notices.
- GitHub Enterprise Server support: API requests go to `GITHUB_API_URL`, which the runner sets for the instance, and fall back to `https://api.github.com` when it is unset.

### Changed

- `secret-in-diff` and `skipped-tests` are on by default, so workflows that use `@v0` report them as soon as they pick up this release. Each can be turned off in `.prism-review.yml`.
- `rules.missingTests.testGlobs` also matches `__tests__/` directories and Python, Go, and Rust test files by default. Changes to those files now count as test changes for `missing-tests`.
- Finding messages say "This file" instead of repeating the path; the path is shown on the `File:` line.

### Fixed

- The documented workflow permissions could not post the review comment. On a pull request, the token needs `pull-requests: write`; `issues: write` with `pull-requests: read` fails with `403 Resource not accessible by integration`. The README, the example workflow, and the dogfood workflow now request `contents: read` and `pull-requests: write`.
- A pull request file name containing backticks or newlines could add Markdown, such as headings, a fake risk level, or HTML comments, to the review comment. Paths are now shown in code spans with newlines spelled out, which also keeps @mentions and issue references in file names from notifying anyone, and finding text is escaped.
- With `dry-run: true`, a pull request file name containing a newline could issue workflow commands, such as forged annotations or `::add-mask::`, through the printed review.

## 0.3.0 - 2026-07-24

### Added

- The action loads its configuration from the pull request base commit through the contents API, so a pull request cannot relax the rules that review it.
- `config-change` rule flags any change to the configuration file, including adding, deleting, or renaming it, as high risk.
- `comment.mode: append` posts a new comment on every run.
- `npm run test:action` runs the bundled action end to end against a fake GitHub API, and CI runs it after rebuilding the bundle.
- MIT `LICENSE` file.

### Changed

- Workflows no longer need `actions/checkout`; the action reads everything through the GitHub API.
- `config-path` must be a relative path inside the repository.
- Configuration errors name the file, the base commit, and the rejected field.
- `upsert` updates the most recent comment that a bot posted starting with the marker.
- `analyzePullRequest` takes an options object with `rules` and `configPath`.
- Renamed files carry `previousPath`.
- GitHub API failures raise `GitHubApiError`, which keeps the HTTP status.
- CI runs on Node 24, the same runtime the action declares.

### Fixed

- Action inputs were read from `INPUT_GITHUB_TOKEN` instead of `INPUT_GITHUB-TOKEN`, so the action failed on every pull request with a missing `github-token` error.
- `upsert` could overwrite any comment that contained the marker, including a person's reply that quoted the review.
- `comment.mode: append` was accepted by the schema but behaved like `upsert`.
- `docs/sample-review-comment.md` listed findings in a different order than the real output.

## 0.2.0 - 2026-07-21

### Added

- `security.maxPatchBytes` drops oversized patches before redaction and analysis.
- `oversized-patch` rule reports files whose patch was not inspected.
- `security.redaction.allowlist` keeps known false positives readable.
- Mocked `fetch` tests for the GitHub client, pull request file mapping, and comment upserts.
- CI check that fails when the committed bundle is stale.

### Changed

- The action and CLI ship as self-contained bundles in `dist/`, built with esbuild.
- Type checking and tests compile into `build/` instead of `dist/`.
- The action runs on the `node24` runtime.
- GitHub API requests time out after 15 seconds, pagination stops after 30 pages, and error details are truncated.

### Fixed

- `action.yml` pointed at an entrypoint that was never generated.
- The action failed at runtime because its dependencies were not available on the runner.
- `comment.includeLowSeverity` was ignored by the Markdown renderer.
- CI did not run on pushes to `master`.
- `brace-expansion` updated to a release without the unbounded expansion advisories.

## 0.1.0 - 2026-07-15

### Added

- Deterministic pull request analysis engine with `large-diff`, `missing-tests`, `sensitive-files`, and `dependency-risk` rules.
- GitHub Action integration with a single upserted pull request comment.
- Secret redaction for patch content.
- Fixture-based CLI analysis and unit tests.
