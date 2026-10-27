# Changelog

All notable changes to Prism Review are documented in this file.

## 0.23.0 - 2026-10-27

### Added

- `review-control-change` rule, a warning for changes to `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS`, and for added or removed `.gitattributes` lines that set `linguist-generated` or `linguist-vendored`. Both files are read from the base branch, so these changes decide how later pull requests are reviewed. Like `config-change`, the rule reads files matched by `ignorePaths` and cannot be suppressed inline. Other `.gitattributes` changes, such as `eol`, are not reported, and a patch too large to read is reported anyway.

## 0.22.0 - 2026-10-27

### Added

- `ignoreGenerated`, on by default, leaves files that `.gitattributes` marks `linguist-generated` or `linguist-vendored` out of the noise rules, like `ignorePaths`. The action reads `.gitattributes` from the base commit and the CLI from the current directory. Patterns follow gitattributes, so a directory pattern needs `/**`, and the last matching line wins, so `-linguist-vendored` brings files back. The rules that `ignorePaths` cannot hide still read these files, and the summary counts them apart.
- A `.gitattributes` that cannot be read logs a warning, and the review goes on with every file.

## 0.21.0 - 2026-10-27

### Added

- Each finding that points to a file names the file's owners from CODEOWNERS on an `Owners:` line, and the checklist asks whether the owners of the flagged files reviewed the change. The action reads `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS` from the base commit, as GitHub does; the CLI reads them from the current directory. Owners are shown in code spans, so nobody is notified. `comment.codeOwners: false` turns this off.
- A CODEOWNERS file that cannot be read logs a warning, and the review goes on without owners.

## 0.20.0 - 2026-10-27

### Added

- Each finding in the comment and each review comment on a line ends with a `Rule:` line: the rule's id, which is what an inline suppression names, linked to the rule's section in `docs/configuration.md`. The SARIF report links each rule to its section instead of the top of the document.
- `docs/configuration.md` has sections for `large-diff` and `missing-tests`, so every rule has one. A test checks that each rule's link points at a heading that exists.

## 0.19.1 - 2026-10-27

### Added

- `action.yml` has `branding`, a `shield` icon on `purple`, which GitHub Marketplace requires to list the action.
- A Release workflow creates the GitHub release for each pushed version tag, with the tag's section of this changelog as its notes, after checking that the tag matches `package.json`. It can also be run by hand for tags pushed before it existed. `scripts/release-notes.mjs` prints the notes for any version.
- `docs/releasing.md` describes how to prepare, tag, and publish a release, including the GitHub Marketplace listing.

## 0.19.0 - 2026-10-27

### Added

- The Suggested Review Checklist asks one question for each rule that reported a finding the comment shows, most severe first and at most 8, such as whether an added credential was revoked or whether a migration can be rolled back while the previous release is still running. A review without such findings keeps the four general questions.
- `comment.checklist` adds up to 10 questions of the repository's own to every review's checklist.

### Changed

- The checklist counts toward the comment's size limit, so long custom questions leave less room for findings instead of pushing the comment over GitHub's limit.

## 0.18.0 - 2026-10-27

### Added

- The review comment marks each finding that is new since the previous review with `(new)`, and opens the findings with a line that counts new findings and the ones no longer reported, by rule. The comment ends with a hidden record of its findings, as rule ids and hashes of each finding's file and title, which the next run reads from the newest review comment's last line. The same finding on another line is not new. A first review, a dry run, a comment from an older version, or a record of more than 400 findings marks nothing.

### Changed

- The action reads the existing review comment before rendering the review, so in `append` mode it also lists comments once per run.

## 0.17.0 - 2026-10-27

### Added

- The review comment groups findings by area (Secrets, Supply Chain, Infrastructure, Code, Tests, and Review Scope) when they come from more than one, with a line that counts them per area. The most severe area comes first. When the comment reaches its size limit, the counts still include every finding and each area heading says how many are shown.
- Each finding in the JSON output has an `area` field, and each rule in the SARIF report carries its area as a tag.

### Changed

- `docs/sample-review-comment.md` shows the grouped layout.

## 0.16.0 - 2026-10-27

### Added

- `reviewComments` posts each line finding as a pull request review comment on its line, opt-in with `reviewComments.enabled`. Comments are updated in place on later runs and edited to say a finding is no longer reported instead of being deleted. Lines GitHub does not accept are skipped with a warning, and `maxComments`, 25 by default, caps how many one run posts.
- Prompt-injection fixtures and tests for instructions in base64, Markdown and HTML comments, a file name, a suppression reason that claims approval, and Unicode tag characters. None of them changes the review, and none of the injected text reaches the comment, the JSON, or the SARIF report, except a file name inside a code span.

### Changed

- `docs/roadmap.md` lists everything shipped through 0.15.0.

## 0.15.0 - 2026-10-27

### Added

- `overrides` sets rule severity for findings in matching files only, such as `risky-api: off` under `legacy/**`. The top-level `severity` applies first, then each matching entry in order. Findings without a file are not affected, and unknown rule ids fail configuration loading.

## 0.14.1 - 2026-10-27

### Fixed

- Several rule patterns took time quadratic in a line's length on crafted input, so one long line, such as `curl curl curl ...`, `{{{{...`, or `${{ ${{ ...`, could take seconds and stall a review. Every repeatable span is now bounded, and a test runs each case on a 200,000-character line under three seconds. The affected rules are `lockfile-source`, `remote-script`, `disabled-security-check`, `privileged-container`, `destructive-migration`, `sql-injection`, `workflow-risk`, `blanket-suppression`, `risky-api`, `skipped-tests`, `public-exposure`, and the inline suppression marker.

## 0.14.0 - 2026-10-27

### Added

- The CLI takes `--format json` and `--format sarif`. JSON lists the risk level, counts, findings with every line they cover, and suppressed findings with their reasons. SARIF 2.1.0 places each finding on its file and line for GitHub code scanning, with inline suppressions as in-source suppressions. `check.failOn` sets the exit status in every format.
- The `sarif-file` action input also writes the review as SARIF, for `github/codeql-action/upload-sarif`. The README shows a workflow that uploads it.

## 0.13.0 - 2026-10-27

### Added

- Inline suppressions: a `prism-review-ignore rule-id -- reason` comment after the code, or alone on the line above, acknowledges a finding on that line. Suppressed findings leave the risk level and `check.failOn` and are listed with their reasons under "Suppressed Inline" in the review. A reason is required, every line of a finding must be covered, and the rules `ignorePaths` cannot hide, such as `secret-in-diff` and `credential-file`, cannot be suppressed.

## 0.12.0 - 2026-10-27

### Added

- `sql-injection` rule warns about SQL built by inserting values into the query text, in Python, JavaScript, TypeScript, Go, Java, PHP, C#, and Ruby, including SQL built into a variable first. Parameterized queries, Prisma's tagged templates, and text that only mentions SQL words are not reported. `rules.sqlInjection.enabled` turns it off.
- `disabled-security-check` rule reports, as high, code that turns off TLS certificate verification or token signature and expiry checks, in JavaScript, Python, Go, Java, C#, PHP, Ruby, shell, and Kubernetes configuration, and warns when CSRF protection is turned off in Spring, Django, Flask, or Rails. Documentation and tests are skipped. `rules.disabledSecurityChecks.enabled` turns it off.

## 0.11.0 - 2026-10-27

### Added

- `public-exposure` rule reports, as high, Terraform, CloudFormation, and Kubernetes changes that open SSH, RDP, database, cache, search, or container API ports, or every port, to `0.0.0.0/0` or `::/0`, and that make storage buckets or databases public or grant `allUsers` access. Public web ports, private ranges, outbound rules, and deny rules are not reported. `rules.publicExposure.enabled` turns it off.
- `privileged-container` rule reports, as high, privileged containers, Docker socket mounts, and added `SYS_ADMIN` or `ALL` capabilities in Kubernetes manifests, Helm values, Compose files, and `docker run` commands, and warns about host namespaces, `allowPrivilegeEscalation: true`, and running as root. Dropped capabilities and client settings such as `DOCKER_HOST` are not reported. `rules.privilegedContainers.enabled` turns it off.

## 0.10.0 - 2026-10-27

### Added

- `unpinned-action` rule warns about third-party actions, reusable workflows, and `docker://` images added to workflows by a tag or branch instead of a full commit SHA or digest. `rules.unpinnedActions.allowedOwners` lists owners whose tags are trusted, GitHub's `actions` and `github` by default. Workflows that use Prism Review as `@v0` are reported too; the README shows how to pin it.
- `remote-script` rule warns about commands that download a script and run it unchecked, such as `curl ... | sh`, `bash <(curl ...)`, `eval "$(curl ...)"`, and PowerShell's `iex (iwr ...)`, in Dockerfiles, workflows, Makefiles, and scripts. It is high when the download uses plain HTTP. Commands continued across lines with `\` are read as one. Documentation and tests are skipped. `rules.remoteScripts.enabled` turns it off.

### Changed

- `lockfile-source` also reads package sources in `pyproject.toml`: `name @ URL` dependencies, index URLs, Poetry, uv, and PDM source tables, and inline `git` and `url` sources.

## 0.9.0 - 2026-10-27

### Added

- `lockfile-source` rule reports, as high, lockfile entries and registry settings that download packages from a host outside the allowed registries or over plain HTTP, and warns about Git dependencies and pip `--extra-index-url`. It also reports pip `--trusted-host` as high and a go.mod `replace` that swaps in a different module as a warning. It reads npm, yarn, pnpm, pip, Poetry, Pipfile, uv, Cargo, Bundler, and Go files and `.npmrc`, `.yarnrc.yml`, and `pip.conf`, before the size limit, and `rules.lockfileSources.allowedSources` adds private registries.
- `credential-file` rule reports, as high, committed private keys, key stores, Terraform state, and credential files such as `.git-credentials`, `.aws/credentials`, and `kubeconfig`, and secrets added to `.env`, `.npmrc`, `.yarnrc.yml`, and `.pypirc` files. Environment files are only reported for variables whose name ends with a secret word or URLs with a password, so public, placeholder, and local development values pass. `rules.credentialFiles.enabled` turns it off.

### Fixed

- `dependency-risk` only reported manifests at the repository root, because its default globs such as `package.json` have no `/`. Globs without a `/` in `rules.dependencyRisk.manifests` and `rules.sensitiveFiles.patterns` now match the file name in any directory, as in `.gitignore`, so `packages/ui/package.json` and `services/api/requirements.txt` are reported.

## 0.8.0 - 2026-10-27

### Added

- `workflow-risk` rule reports script injection, as high, when an untrusted context such as an issue title, pull request body, branch name, or commit message is used inside `${{ }}` in a workflow `run` or `script`. It also warns about added `pull_request_target` triggers, checkouts of pull request code, and `permissions: write-all`. Only `run` and `script` values, including multi-line blocks, count as scripts; `env:`, `with:`, `name:`, and `if:` values are data and are not reported. Index syntax and whole objects passed to `toJSON` are recognized, and `ignorePaths` does not hide workflow files. `rules.workflowRisk.enabled` turns it off.
- `destructive-migration` rule reports database migrations that drop a table or column or remove every row, as high, and that rename or redefine a column, as a warning. It reads SQL and the schema calls of Rails, Django, Alembic, Knex, Sequelize, TypeORM, Laravel, Entity Framework Core, and Ecto, and skips rollback sections and files. `rules.destructiveMigration.enabled` turns it off.
- `incomplete-review` rule reports a high-risk finding when GitHub returns its limit of 3000 files and the pull request changes more, so the files that were not reviewed cannot pass a `check.failOn` gate unnoticed.

## 0.7.0 - 2026-10-20

### Added

- `severity` sets a rule's severity, such as `missing-tests: info` or `dependency-risk: high`, or turns it off. It affects the comment, the risk level, annotations, outputs, and `check.failOn`; `large-diff: off` also turns off the size check behind the risk level, and an unknown rule id fails configuration loading.
- The action writes the review to the job summary and sets the `risk-level`, `high-count`, `warning-count`, and `finding-count` step outputs.
- For a `pull_request` run from a fork, where the token is read-only, a 403 on the comment is a warning instead of a failed run, and the review stays in the job summary. A 403 on the repository's own pull requests, on `pull_request_target`, or from a rate limit still fails.
- The comment and job summary stop listing findings before GitHub's comment size limit and say how many were left out, so a pull request with thousands of findings still gets its review.
- `ignorePaths` leaves generated, vendored, or snapshot files out of the noise rules and the size check, and the summary says how many files were ignored. Globs match dotfiles, and a file renamed into an ignored path is still reviewed unless its old path is ignored too. `secret-in-diff`, `hidden-unicode`, and `config-change` still read every file. This repository ignores its `dist/` bundles.

### Changed

- A `pull_request` run for a pull request from a fork used to fail when the read-only token could not post the comment. It now passes with a warning, and `check.failOn` still decides whether the findings fail the job. Every run also writes the review to the job summary.

## 0.6.0 - 2026-10-20

### Added

- `hidden-unicode` rule reports added lines and file names that contain bidirectional controls, as high, or invisible characters such as zero width spaces, invisible operators, Hangul fillers, and Unicode tag characters, as a warning. Patches over `security.maxPatchBytes` are still scanned. These can make code read differently from how it runs (Trojan Source, CVE-2021-42574) or hide instructions from a reviewer. The comment shows hidden characters in file names as `\u{...}` escapes. `rules.hiddenUnicode.enabled` turns it off.
- `fixtures/diffs/prompt-injection.diff` and a test that instructions aimed at an AI reviewer, including a forged review header, do not change the review or reach the comment.
- The CLI reviews a diff from standard input with `analyze --diff -`, so `git diff origin/main...HEAD | prism-review analyze --diff -` works as a pre-push check together with `check.failOn`. `--diff` also takes a file path, and `--fixture` remains as an alias. `--help` prints usage. Input that cannot be reviewed, such as an empty diff, colored output, or text with no `diff --git` section, is an error rather than an empty review that passes, and git's quoted file names and `diff.mnemonicPrefix` and `diff.noprefix` output are parsed.
- `risky-api`, `blanket-suppression`, and `skipped-tests` cover Ruby, Java, Kotlin, and PHP: `eval`, shell commands, `Marshal.load`, `.html_safe`, `Runtime.exec`, Java deserialization, `unserialize`, and PHP shell functions; `rubocop:disable all`, `@SuppressWarnings("all")`, `CHECKSTYLE:OFF`, `NOSONAR`, `@phpstan-ignore-line`, and bare `phpcs:ignore`; RSpec focus and skip blocks, Minitest `skip`, JUnit `@Disabled` and `@Ignore`, TestNG `enabled = false`, PHPUnit `markTestSkipped`, and Pest `->only()` and `->skip()`.
- The same rules cover C# and Swift: `Process.Start` with a shell, `BinaryFormatter` and other unsafe .NET deserializers, `Html.Raw`, a Swift `Process` that runs `/bin/sh`, `NSKeyedUnarchiver.unarchiveObject`, and `evaluateJavaScript` with interpolation; `#pragma warning disable` with no codes, `ReSharper disable All`, and `swiftlint:disable all`; xUnit `Skip =`, NUnit and MSTest `[Ignore]`, `XCTSkip`, and Swift Testing `.disabled`.

### Changed

- `hidden-unicode` is on by default, and the line-level rules now also read Ruby, Java, Kotlin, PHP, C#, and Swift, so workflows that use `@v0` can report new findings as soon as they pick up this release. With `check.failOn: high`, a bidirectional control character fails the job. Each rule can be turned off in `.prism-review.yml`.
- The CLI fails with a clear error when `--config` names a file that does not exist, instead of silently using the defaults, and rejects unknown options instead of ignoring them.
- `rules.missingTests.testGlobs` also matches `*_spec.rb`, `*_test.rb`, `src/test/**`, `*Test.php`, `*Tests.cs`, `*Test.cs`, `*.Tests/**`, and `*Tests.swift` by default, so changes to those files count as test changes.
- `skipped-tests` only applies each framework's markers to files of its own language, so a Go `.Skip(` call in a JavaScript test is no longer reported.

## 0.5.0 - 2026-10-20

### Added

- `risky-api` rule warns, with the line number, when a pull request adds a call that runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML in JavaScript, TypeScript, Python, or Go source. Member calls and definitions with the same name, such as `pattern.exec(input)`, `model.eval()`, and `def eval(self):`, are not reported, and test files are skipped. `rules.riskyApis.enabled` turns it off.
- `check.failOn` fails the job when the review has a finding at or above `high` or `warning`, after the comment and annotations are published, so branch protection can require Prism Review to pass. The default, `never`, keeps the current behavior. The CLI exits with status 1 under the same condition.
- `blanket-suppression` rule warns, with the line number, when a pull request adds a lint or type check suppression that names no rule: `eslint-disable` without rule names, `@ts-nocheck`, `@ts-ignore`, a bare `# noqa` or `# type: ignore`, `# pylint: disable=all`, `# mypy: ignore-errors`, `//nolint` without a linter, and Rust `allow(warnings)` or `allow(clippy::all)`. Each marker only counts in files of its own language, and targeted suppressions are not reported. `rules.blanketSuppression.enabled` turns it off.

### Changed

- `risky-api` and `blanket-suppression` are on by default, so workflows that use `@v0` report them as soon as they pick up this release. Each can be turned off in `.prism-review.yml`.

### Fixed

- The README listed six of the ten rules, described the patch size limit as running before all pattern matching, and still listed shipped annotations as roadmap work. A test now fails when a registered rule is missing from the README or `docs/configuration.md`.
- `sensitive-files` reported files such as `docs/rule-authoring.md`, `src/tokenizer.ts`, and `AUTHORS` as high risk because their paths contain `auth` or `token`. A short list of words that only look related (`author`, `tokenize`, `parole`, `secretary`) is now left out; every other path that contains a sensitive word, such as `Unauthorized.ts` or `jwtauth/`, is still reported.

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
