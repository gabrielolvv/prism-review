# Changelog

All notable changes to Prism Review are documented in this file.

## Unreleased

### Added

- `annotations.enabled` prints findings that name a file as workflow command annotations, so they appear beside the file in the pull request diff without the `checks: write` permission. `annotations.includeLowSeverity` adds `info` findings as notices.
- GitHub Enterprise Server support: API requests go to `GITHUB_API_URL`, which the runner sets for the instance, and fall back to `https://api.github.com` when it is unset.

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
