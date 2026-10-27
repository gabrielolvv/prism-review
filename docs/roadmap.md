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
- Ruby, Java, Kotlin, PHP, C#, and Swift patterns for `risky-api`, `blanket-suppression`, and `skipped-tests`.
- `analyze --diff -` in the CLI, for reviewing local changes before pushing.
- `hidden-unicode` rule for bidirectional controls and invisible characters, and a prompt-injection fixture with a test that the review ignores it.
- `severity` overrides, the job summary and step outputs, read-only fork tokens that warn instead of failing, a comment size cap, and `ignorePaths` (0.7.0).
- `workflow-risk`, `destructive-migration`, and `incomplete-review` rules (0.8.0).
- `credential-file` and `lockfile-source` rules, and manifest globs that match in every directory (0.9.0).
- `remote-script` and `unpinned-action` rules, and `pyproject.toml` package sources (0.10.0).
- `privileged-container` and `public-exposure` rules (0.11.0).
- `disabled-security-check` and `sql-injection` rules (0.12.0).
- Inline suppressions with a required reason, listed in the review (0.13.0).
- JSON and SARIF output, and a `sarif-file` input for code scanning (0.14.0).
- Linear-time rule patterns, with a test against crafted long lines (0.14.1).
- Per-path `overrides` of rule severity (0.15.0).
- Opt-in `reviewComments` that post line findings as pull request review comments, updated in place and marked resolved instead of deleted, and prompt-injection fixtures with instructions in base64, Markdown and HTML comments, a file name, a suppression reason, and Unicode tag characters (0.16.0).
- Findings grouped by area in the review, with a count for each area, and the area in the JSON and SARIF output (0.17.0).
- New findings marked since the previous review, with a count of findings no longer reported, from a hashed record kept in the review comment (0.18.0).
- A reviewer checklist with a question for each rule that reported a finding, and `comment.checklist` for questions of the repository's own (0.19.0).
- Marketplace branding, and GitHub releases created from pushed version tags (0.19.1).
- A link from each finding to its rule's section in `docs/configuration.md`, which now covers every rule (0.20.0).
- The CODEOWNERS owners of each flagged file, read from the base commit and shown without notifying anyone (0.21.0).
- Files marked `linguist-generated` or `linguist-vendored` in `.gitattributes` left out like `ignorePaths` (0.22.0).
- `review-control-change` rule for changes to CODEOWNERS and to the files `.gitattributes` marks generated or vendored (0.23.0).
- `lookalike-dependency` rule for added dependencies one character away from a popular npm, PyPI, RubyGems, or crates.io package, from a bundled list (0.24.0).
- A Dependency Changes table of the packages a pull request adds, removes, or moves to another version, also in the JSON output.

## Near Term

### Flag downgrades and loosened version pins

The dependency changes now say what moved from which version to which. Two of those moves deserve a warning of their own: a dependency moved to an older version, which can bring back fixed vulnerabilities, and an exact pin loosened to a range, `*`, or `latest`, which lets an unreviewed release in on the next install.

## Mid Term

### Add optional AI review summaries

Add provider interfaces, prompt construction, schema validation, and graceful fallback. AI output must remain advisory and grounded in redacted diff snippets. The prompt-injection fixtures are in place and should be extended to check the AI output too, before it ships.

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
