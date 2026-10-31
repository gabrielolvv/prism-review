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
- A Dependency Changes table of the packages a pull request adds, removes, or moves to another version, also in the JSON output (0.25.0).
- `risky-dependency-version` rule for dependencies moved to an older version or left open to any future release (0.26.0).
- `stale-lockfile` rule for manifests whose dependencies change while their lockfile, on the base commit, is not updated (0.27.0).
- Go modules in the dependency checks, read from `go.mod` with `go.sum` as the lockfile (0.28.0).
- Composer and NuGet manifests in the dependency checks, with `composer.lock` and per-project `packages.lock.json` (0.29.0).
- Maven and Gradle builds in the dependency checks: `pom.xml` dependency blocks, Gradle build scripts, and version catalogs, with `gradle.lockfile` (0.30.0).
- An optional AI summary written from the redacted diff, behind a provider interface, with a validated reply, a fallback that publishes the review without it, and prompt-injection fixtures checked against what the model is sent and what the comment shows (0.31.0).
- Scoped npm packages in the dependency checks (0.32.0).
- zod 4, which fixes GHSA-mrhx-c7xc-m3w5 (0.33.0).
- `dockerfile-risk` rule for unpinned base images, unchecked remote `ADD`, secrets in `ENV` or `ARG`, and a final `USER root` (0.34.0).
- `insecure-infrastructure` rule for IAM policies that allow every action, and encryption, TLS 1.2, audit logging, or IMDSv2 turned off in Terraform and CloudFormation (0.35.0).
- Workflow permissions: write scopes granted to every job at the top of a workflow, and new workflows that set no permissions (0.36.0).
- `sensitive-files` keeps high for configured paths and warns for files that only a word in their path marks sensitive, leaving out documentation, tests, and fixtures (0.37.0).
- `kubernetes-rbac` rule for bindings to cluster-admin, roles granted to everyone, wildcard verbs and resources, and the escalate, bind, and impersonate verbs (0.38.0).
- `file-permissions` rule for world-writable modes, the setuid bit, and an open umask, in shell, Dockerfiles, and code (0.39.0).
- Marketplace-ready README, `SECURITY.md`, and listing checklist (0.39.1).
- `insecure-web-config` rule for CORS that allows every origin with credentials, cookies without HttpOnly or Secure, and debug modes in production (0.40.0).
- `weak-crypto` rule for secrets hashed with MD5 or SHA-1, broken ciphers, ECB mode, and secrets made with non-cryptographic random numbers (0.41.0).
- `untrusted-input` rule for request values passed straight to redirects, outgoing requests, and file paths (0.42.0).
- False positives measured on about 16,000 files from 39 popular packages and fixed in nine rules, with a script to repeat the check and an index of every rule by area.
- README image of a review, comparison with other tools, `CONTRIBUTING.md`, and issue forms (0.43.1).
- `prism-review init`, which sets up the workflow and configuration pinned to the release commit, `--version`, and the CLI on npm (0.44.0).
- `xml-external-entities` rule for XML parsers that turn on DTDs or external entities (0.45.0).
- `hardcoded-jwt-secret` rule for JSON Web Tokens signed or verified with a key written in the code (0.46.0).
- `analyze --staged`, `--base`, and `--fail-on`, a pre-commit hook, and a GitLab CI example (0.47.0).
- Fewer false positives in `destructive-migration`, `sql-injection`, and every rule that skips tests, which now include `test/`, `tests/`, and `spec/` directories (0.48.0).
- `--format text` for terminals and the pre-commit hook (0.49.0).
- False positives measured on about 18,600 files from popular Go modules and Java libraries and fixed in seven rules (0.50.0).
- `mass-assignment` rule for requests that can set every field of a model (0.51.0).
- `redos` rule for regular expressions that can take exponential time (0.52.0).
- SameSite=None cookies in `insecure-web-config` (0.53.0).
- `extends` for configuration shared across repositories (0.54.0).
- `secret-logging` rule for secrets written to logs (0.55.0).
- `url-credentials` rule for passwords in connection URLs (0.56.0).
- `unescaped-html` rule for template output written without HTML escaping (0.57.0).
- `timing-unsafe-comparison` rule for secrets compared in variable time (0.58.0).
- `postmessage-origin` rule for cross-window messages without an origin check (0.59.0).
- `nosql-injection` rule for request values in MongoDB filters (0.60.0).
- `template-injection` rule for templates compiled from request input (0.61.0).
- `prototype-pollution` rule for unguarded recursive merges and nested request keys (0.62.0).
- `ldap-xpath-injection` rule for LDAP filters and XPath expressions built from text (0.63.0).
- `upload-filename` rule for uploads saved under the client's file name (0.64.0).
- `reflected-xss` rule for request values written into HTML responses (0.65.0).
- `log-injection` rule for request values written into log text (0.66.0).
- `static-iv` rule for encryption with a fixed IV or nonce (0.67.0).
- `plaintext-password` rule for passwords compared in plain text (0.68.0).
- `admin-route-auth` rule for admin routes without an access check (0.69.0).
- Security severities, related locations, and rule help in the SARIF report (0.70.0).
- No private key findings for throwaway keys in tests, examples, and docs (0.71.0).
- No NoSQL injection findings for service layers and SQL ORM filters (0.72.0).
- Fewer timing findings for stored fields, generated code, and mocks (0.73.0).
- Vendored dependencies and build output left out of noise rules by default (0.74.0).
- Findings below a key whose value is on the next line keep their line numbers (0.74.1).
- No blanket suppression findings for Python markers that can only cover one check (0.75.0).
- No risky API findings in comments, docstrings, or minified lines (0.76.0).

## Later

### Add GitHub App mode

Move beyond per-repository GitHub Actions with webhook processing, queue-based workers, review history, and organization-level policy analytics.
