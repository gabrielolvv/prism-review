# Configuration

Prism Review reads `.prism-review.yml` from the repository root by default. Every option is optional; missing values fall back to the defaults shown below.

## Where the Configuration Comes From

The action reads the configuration from the **base commit** of the pull request through the GitHub contents API, not from the pull request itself. A pull request that edits the configuration is reviewed with the rules that were already merged, and the edit is reported by the `config-change` rule.

- `config-path` selects the file. It must be a relative path inside the repository; absolute paths and `..` segments fail the run.
- When the file does not exist on the base commit, the defaults apply and the log says so. This is the case for the pull request that first adds a configuration file, which also receives a high-risk `config-change` finding.
- The CLI reads the file from disk, because it reviews local diffs and has no base commit. It uses `.prism-review.yml` in the current directory when present, or the file passed with `--config`; a `--config` path that does not exist is an error rather than a silent fallback to the defaults.

## Example

```yaml
risk:
  largeDiff:
    maxFiles: 25
    maxChangedLines: 800

rules:
  missingTests:
    enabled: true
    sourceGlobs:
      - "src/**/*.{ts,tsx,js,jsx}"
    testGlobs:
      - "**/*.test.*"
      - "**/*.spec.*"
      - "**/__tests__/**"
      - "**/test_*.py"
      - "**/*_test.py"
      - "**/*_test.go"
      - "**/tests/**/*.rs"
      - "**/*_spec.rb"
      - "**/*_test.rb"
      - "**/src/test/**"
      - "**/*Test.php"
      - "**/*Tests.cs"
      - "**/*Test.cs"
      - "**/*.Tests/**"
      - "**/*Tests.swift"
  sensitiveFiles:
    enabled: true
    patterns:
      - ".github/workflows/**"
      - "**/auth/**"
      - "**/permissions/**"
      - "**/migrations/**"
  dependencyRisk:
    enabled: true
    manifests:
      - "package.json"
      - "package-lock.json"
      - "pnpm-lock.yaml"
      - "yarn.lock"
      - "requirements.txt"
      - "pyproject.toml"
      - "poetry.lock"
      - "go.mod"
      - "go.sum"
      - "Cargo.toml"
      - "Cargo.lock"
  secretInDiff:
    enabled: true
  skippedTests:
    enabled: true
  blanketSuppression:
    enabled: true
  riskyApis:
    enabled: true
  workflowRisk:
    enabled: true

security:
  maxPatchBytes: 200000
  redaction:
    allowlist: []

comment:
  mode: "upsert"
  includeLowSeverity: false

annotations:
  enabled: false
  includeLowSeverity: false

check:
  failOn: "never"

ignorePaths: []

severity: {}
```

Invalid values fail the run with the file and the field that was rejected, for example `Invalid Prism Review configuration in .prism-review.yml at 1a2b3c4: risk.largeDiff.maxFiles: Number must be greater than 0`.

## Sensitive Files

### `rules.sensitiveFiles.patterns`

The `sensitive-files` rule reports a high-risk finding for each changed file that matches one of these globs, or whose path contains a built-in sensitive word: `auth`, `permission`, `role`, `session`, `token`, `jwt`, `billing`, `payment`, `secret`, `migration`, `workflow`, or `Dockerfile`.

The path is split into words on `/`, `.`, `-`, `_`, and camelCase, and a word counts when it contains a sensitive word, so `src/errors/Unauthorized.ts`, `pkg/jwtauth/`, `src/accesstoken.ts`, and `db/migrations/` are reported. A short list of words that only look related is left out: `author` and its forms (but not `authorize`), `tokenize`, `parole`, and `secretary`. That keeps `docs/rule-authoring.md`, `AUTHORS`, and `src/tokenizer.ts` from being reported.

### `rules.sensitiveFiles.enabled`

Set to `false` to turn the rule off, including the built-in words.

## Dependency Risk

### `rules.dependencyRisk.manifests`

The `dependency-risk` rule warns for each changed file that matches one of these globs. The defaults cover Node.js, Python, Go, and Rust manifests and lockfiles, and the message names the ecosystem. `rules.dependencyRisk.enabled: false` turns the rule off.

## Skipped Tests

### `rules.skippedTests.enabled`

The `skipped-tests` rule reports a warning, with the first line number, when a pull request adds a focus or skip marker to a test file. A focused test makes the runner skip every other test in scope, and a skipped test stops running without failing anything.

| Framework | Focused | Skipped |
| --- | --- | --- |
| Jest, Vitest, Mocha, Jasmine, `node:test` | `describe.only`, `it.only`, `test.only` (and `.each`), `fdescribe`, `fit` | `describe.skip`, `it.skip`, `test.skip` (and `.each`), `xdescribe`, `xit`, `xtest` |
| pytest, unittest | | `@pytest.mark.skip`, `@pytest.mark.skipif`, `pytest.skip(...)`, `@unittest.skip`, `@unittest.skipIf`, `@unittest.skipUnless` |
| Go | | `.Skip`, `.Skipf`, `.SkipNow` on any receiver, such as `t`, `b`, or `s.T()` |
| Rust | | `#[ignore]` |
| RSpec, Minitest | `fit`, `fdescribe`, `fcontext` and the other `f`-prefixed blocks, `focus: true`, `:focus` | `xit`, `xdescribe`, `xcontext` and the other `x`-prefixed blocks, `skip`, `pending` |
| JUnit, TestNG | | `@Disabled`, `@Ignore`, `@Test(enabled = false)` |
| PHPUnit, Pest | `->only()` | `$this->markTestSkipped(...)`, `$this->markTestIncomplete(...)`, and `->skip(...)` chained on a Pest test, but not Laravel's `->skip(10)` |
| xUnit, NUnit, MSTest | | `[Fact(Skip = ...)]`, `[Theory(Skip = ...)]`, `[Ignore]`, including combined forms such as `[Test, Ignore("...")]` |
| XCTest, Swift Testing | | `throw XCTSkip(...)`, `XCTSkipIf`, `XCTSkipUnless`, `@Test(.disabled(...))` |

Only files matched by `rules.missingTests.testGlobs` are checked, so the same calls in application code are not reported, and each framework's markers only count in files of its own language. JavaScript markers must not follow a `.`, so calls such as `chart.fit(...)` do not count, and RSpec markers must start the line and not be an assignment. The exception is Rust's `#[ignore]`, which is checked in every `.rs` file because unit tests live next to the code and the attribute only applies to tests.

Conditional skips such as `skipif` are reported too: the reviewer should know where a test stops running, even when it is intended. Removing a marker is never reported.

Adding a skip marker counts as a test change, so it also keeps `missing-tests` quiet; this rule is what reports it.

## Blanket Suppressions

### `rules.blanketSuppression.enabled`

The `blanket-suppression` rule warns, with the first line number, when a pull request adds a lint or type check suppression that does not name the checks it turns off. Such a suppression hides every problem in its scope, including ones introduced later.

| Tool | Reported | Not reported |
| --- | --- | --- |
| ESLint | `/* eslint-disable */`, `// eslint-disable-next-line`, `// eslint-disable-line` with no rule names | the same comments followed by rule names |
| TypeScript | `// @ts-nocheck`, `// @ts-ignore` | `// @ts-expect-error` |
| flake8, Ruff | `# noqa`, `# flake8: noqa`, `# ruff: noqa` | `# noqa: E501` |
| mypy, Pyright | `# type: ignore`, `# mypy: ignore-errors` | `# type: ignore[arg-type]` |
| Pylint | `# pylint: disable=all` | `# pylint: disable=line-too-long` |
| golangci-lint | `//nolint` | `//nolint:errcheck` |
| Rust | `#[allow(warnings)]`, `#[allow(clippy::all)]`, and the `#![...]` forms | `#[allow(dead_code)]` |
| RuboCop | `# rubocop:disable all`, `# rubocop:todo all` | `# rubocop:disable Metrics/MethodLength` |
| Java, Kotlin | `@SuppressWarnings("all")`, `// CHECKSTYLE:OFF`, `// NOSONAR` | `@SuppressWarnings("unchecked")` |
| C# | `#pragma warning disable` with no codes, `// ReSharper disable All` | `#pragma warning disable CS0618` |
| SwiftLint | `// swiftlint:disable all`, including the `:next`, `:this`, and `:previous` forms | `// swiftlint:disable force_cast` |
| PHPStan, PHP_CodeSniffer, Psalm | `@phpstan-ignore-line`, `@phpstan-ignore-next-line`, `phpcs:ignoreFile`, `phpcs:ignore` or `phpcs:disable` with no sniff, `@codingStandardsIgnoreFile`, `@psalm-suppress all` | `@phpstan-ignore argument.type`, `phpcs:ignore Generic.Files.LineLength` |

Only added lines are checked, and each marker only counts in files of its own language: ESLint and TypeScript markers in JavaScript and TypeScript sources, Python markers in `.py` and `.pyi` files, and so on. A `#noqa` inside a URL in a `.ts` file is not a suppression, and documentation that quotes these markers is never reported.

## Risky APIs

### `rules.riskyApis.enabled`

The `risky-api` rule warns, with the first line number, when a pull request adds a call that runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML. These calls are not wrong in themselves, but a reviewer should check where their input comes from.

| Language | Reported | Not reported |
| --- | --- | --- |
| JavaScript, TypeScript | `eval(...)` and `window.eval(...)`, `new Function(...)`, `exec` and `execSync` from `child_process` (bare, or as `cp.`, `childProcess.`, or `child_process.`), a `shell: true` option, `dangerouslySetInnerHTML`, assignments to `innerHTML` or `outerHTML`, `document.write` | `pattern.exec(input)`, `execFile(...)`, `textContent =`, comparisons such as `innerHTML === x` |
| Python | `eval(...)`, `exec(...)`, `pickle`, `marshal`, and `shelve` loads, `yaml.load` and `yaml.load_all` without a safe loader on the same line, `yaml.unsafe_load`, `shell=True`, `os.system`, `os.popen` | `model.eval()`, `yaml.safe_load`, `yaml.load(..., Loader=yaml.SafeLoader)`, `json.loads`, `shell=False` |
| Go | `exec.Command` that runs a shell with a command string, such as `sh -c`, `/bin/bash -lc`, `cmd /C`, or `powershell -Command`, and `template.HTML(...)` | `exec.Command("git", "status")` |
| Ruby | `eval`, `instance_eval`, `class_eval`, and `module_eval` with a string, heredoc, or variable, `system`, `exec`, and `spawn` with a string, including `Kernel.` and `Process.` calls, `%x(...)` and backticks with interpolation outside a string literal, `Marshal.load`, `YAML.unsafe_load`, `.html_safe`, `raw(...)` | `calculator.eval(...)`, `def eval`, `class_eval do ... end`, `YAML.safe_load` |
| Java, Kotlin | `Runtime.getRuntime().exec(...)`, `ProcessBuilder` that runs a shell with a command string, `ObjectInputStream`, `XMLDecoder` | `new ProcessBuilder("git", "status")` |
| C# | `Process.Start` or `ProcessStartInfo.FileName` with `cmd`, `powershell`, `sh`, or `bash`, `BinaryFormatter` and the other unsafe .NET deserializers, `Html.Raw(...)` | `Process.Start("git", "status")`, `JsonSerializer.Deserialize`, `Html.Encode` |
| Swift | a `Process` that runs `/bin/sh`, `/bin/bash`, or `/bin/zsh`, `NSKeyedUnarchiver.unarchiveObject`, `NSUnarchiver`, `evaluateJavaScript` with string interpolation | `/usr/bin/git`, `JSONDecoder`, `evaluateJavaScript` with a fixed string |
| PHP | `eval(...)`, `exec`, `shell_exec`, `system`, `passthru`, `popen`, `proc_open`, `unserialize(...)` | `$runner->exec(...)`, `Foo::exec(...)`, `function exec(...)`, `json_decode(...)` |

Only added lines are checked, and lines that define a function or method with one of these names, such as `def eval(self):` or a class method `exec(command) {`, are not reported. Files matched by `rules.missingTests.testGlobs` are skipped, because tests call these on purpose with fixed input, and only source files of the languages above are scanned.

## Workflow Risk

### `rules.workflowRisk.enabled`

The `workflow-risk` rule checks added lines in `.github/workflows/*.yml` and in `action.yml` files of composite actions:

| Reported | Severity | Why |
| --- | --- | --- |
| An untrusted context, such as `github.event.issue.title`, `github.event.pull_request.body`, `github.head_ref`, or a commit message, inside `${{ }}` in a `run` or `script` value | High | The value is pasted into the script before it runs, so its author can inject commands. |
| A `pull_request_target` trigger | Warning | The run has a writable token and the repository's secrets. |
| A `ref:` that checks out the pull request head or `refs/pull/...` | Warning | Combined with `pull_request_target`, it runs untrusted code with those secrets. |
| `permissions: write-all` | Warning | Every job gets every write permission. |

Only `run` and `script` values, including `|` and `>` blocks, are scripts. Every other value is data and is not reported: `TITLE: ${{ github.event.issue.title }}` under `env:`, an action input under `with:`, a step `name:`, `run-name:`, and `if:` conditions, followed by `run: echo "$TITLE"`. When a hunk starts inside a block, the unchanged lines GitHub shows around it are used to tell which block an added line belongs to.

The untrusted contexts follow GitHub Security Lab's list. Index syntax such as `github.event['issue']['title']` is read like the dotted form, and a context passed whole, as in `toJSON(github.event.pull_request)`, counts too. Safe values such as `github.event.pull_request.number` and `github.sha` are not reported. `pull_request_target` is only reported as a trigger under `on:`, not in comments, strings, or `if:` conditions.

Workflow files are checked even when `ignorePaths` matches them, because a pattern such as `**/*.yml` must not hide them.

## Hidden Unicode

### `rules.hiddenUnicode.enabled`

The `hidden-unicode` rule reports added lines, and file names, that contain characters which are invisible or change the order text is displayed in:

- Bidirectional controls, U+202A to U+202E and U+2066 to U+2069, are reported as **high**. They can make code display differently from how it runs, as in the Trojan Source attacks (CVE-2021-42574).
- Invisible characters are reported as a **warning**: U+200B ZERO WIDTH SPACE, U+2060 WORD JOINER, the invisible operators U+2061 to U+2064, U+FEFF inside a file, the Hangul fillers U+115F, U+1160, U+3164, and U+FFA0, which are valid in identifiers yet render as nothing, and Unicode tag characters. They can hide text or a variable from a reviewer, including instructions aimed at AI tools.

Patches over `security.maxPatchBytes` are still scanned, like they are for `secret-in-diff`.

The message names each character by code point, and the comment shows hidden characters in file names as `\u{...}` escapes. A byte order mark at the very start of a file, the zero width joiners used by emoji and several scripts, the left-to-right, right-to-left, and Arabic letter marks, and the soft hyphen are not reported, because ordinary text uses them. Every file type is checked, documentation included.

## Secrets

### `rules.secretInDiff.enabled`

The `secret-in-diff` rule reports a high-risk finding, with the line number, when an added line contains a value in a format specific enough to be a real credential:

- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)
- OpenAI-style API keys (`sk-`)
- AWS access key IDs (`AKIA`)
- Private key headers (`-----BEGIN ... PRIVATE KEY-----`, including PGP key blocks)

Removed and unchanged lines are not reported. Patches over `security.maxPatchBytes` are still scanned for these formats, because a credential in a large vendored or generated file is still a leak. Broader patterns, such as long base64 strings and `password: ...` assignments, are still redacted but not reported, because lockfile hashes and type declarations would make them noisy.

The value never appears in the finding, the comment, or the annotation. Values matched by `security.redaction.allowlist` are neither redacted nor reported, which is how to keep a known test value from being flagged.

## Rules Without Options

- `incomplete-review` always runs in the action. GitHub lists at most 3000 files for a pull request, so when the API returned all 3000 and the event says the pull request changes more, it reports a high-risk finding with the number of files that were not reviewed. With `check.failOn: high`, such a pull request cannot pass the gate unreviewed. A shorter list is complete: the count in the event can be out of date after a push, so it is not compared then. The CLI reviews the whole diff it is given, so it never reports this.
- `config-change` always runs. It reports a high-risk finding when a pull request adds, edits, deletes, or renames the file named by `config-path`.
- `oversized-patch` always runs. It reports an `info` finding for each file whose patch exceeded `security.maxPatchBytes`.

## Security

### `security.maxPatchBytes`

Maximum size, in UTF-8 bytes, of a single file patch. Larger patches are dropped before redaction and analysis, and the file is reported by the `oversized-patch` rule as an `info` finding. Secret detection is the exception: it scans the full patch first, so `secret-in-diff` still reports a credential in an oversized file.

### `security.redaction.allowlist`

Regular expressions for values that must not be redacted. Each pattern is tested against the candidate value only, not the surrounding line:

- For assignments such as `password: "changeme-placeholder"`, the candidate is `changeme-placeholder`.
- For standalone tokens, the candidate is the token itself.

```yaml
security:
  redaction:
    allowlist:
      - "^[0-9a-f]{40}$" # git commit hashes
      - "^changeme-"
```

Patterns are limited to 200 characters and must compile as JavaScript regular expressions. An invalid pattern fails configuration loading instead of being ignored.

Anchor patterns with `^` and `$` where possible. A loose pattern such as `[0-9a-f]+` would match part of almost any token and disable redaction for it.

## Comment

### `comment.mode`

- `upsert` (default) keeps a single review comment. It updates the most recent comment that a bot posted with a body starting with the `<!-- prism-review-comment -->` marker, or creates one. Comments written by people are never edited, even when they quote the marker.

  The default `GITHUB_TOKEN` and GitHub App tokens post as a bot. A personal access token posts as its user, so `upsert` never finds the earlier comment and creates a new one on every run.
- `append` posts a new comment on every run, which keeps the history of reviews in the conversation at the cost of more notifications.

### `comment.includeLowSeverity`

When `true`, `info` findings such as `oversized-patch` are rendered in the comment. They are hidden by default to keep the comment focused on warnings and high-risk findings.

## Annotations

### `annotations.enabled`

When `true`, the action also prints each finding that names a file as a workflow command annotation. GitHub shows these beside the file in the pull request's **Files changed** tab and in the run summary, alongside the review comment.

| Severity | Annotation |
| --- | --- |
| `high` | `error` |
| `warning` | `warning` |
| `info` | `notice` |

Findings that are not tied to a file, such as `missing-tests` and `large-diff`, stay in the comment only.

Annotations are printed to the job log, so they need no extra permission and also appear with `dry-run: true`. GitHub shows at most 10 annotations of each type per step; findings are emitted high severity first, so the most important ones survive the limit.

### `annotations.includeLowSeverity`

When `true`, `info` findings are annotated as notices. This is independent of `comment.includeLowSeverity`.

## Ignore Paths

### `ignorePaths`

Globs for changed files that the review leaves out, such as generated bundles, vendored code, or snapshots:

```yaml
ignorePaths:
  - "dist/**"
  - "vendor/**"
  - "**/__snapshots__/**"
```

Ignored files are left out of `large-diff`, `missing-tests`, `skipped-tests`, `blanket-suppression`, `risky-api`, `sensitive-files`, `dependency-risk`, and `oversized-patch`, and out of the risk level's size check. The summary says how many files were ignored.

`secret-in-diff`, `hidden-unicode`, and `config-change` still read every file: a credential in vendored code is still exposed, and a path setting must not be able to hide a Trojan Source edit or a change to the review itself. Like the rest of the configuration, `ignorePaths` is read from the base commit, so a pull request cannot ignore its own files. Globs match dotfiles and dot directories, so `dist/**` covers `dist/.cache/` and `**/*.yml` covers `.github/`. A renamed file is only ignored when its old path is ignored too, so moving `src/auth/session.ts` into `vendor/` is still reviewed.

## Severity

### `severity`

Changes the severity of a rule's findings, or turns a rule off. Keys are rule ids; values are `info`, `warning`, `high`, or `off`:

```yaml
severity:
  missing-tests: info
  dependency-risk: high
  large-diff: off
```

The new severity applies everywhere a severity matters: the comment, the risk level, annotations, the step outputs, and `check.failOn`. `large-diff: off` also turns off the file and line count check that raises the risk level to medium. `info` findings are hidden from the comment unless `comment.includeLowSeverity` is set. An unknown rule id or severity fails configuration loading, so a typo cannot leave a rule at its default unnoticed. The configuration comes from the base commit, so a pull request cannot lower the severity of the rules that review it. Lowering or turning off `secret-in-diff`, `hidden-unicode`, or `config-change` is allowed, but the pull request that does it is reviewed with the old configuration and reported by `config-change` as high risk.

## Check

### `check.failOn`

Fails the job when the review has a finding at or above this severity, so branch protection can require the check to pass before merging.

- `never` (default): the job passes whatever the review finds.
- `high`: the job fails when there is at least one high-risk finding.
- `warning`: the job fails when there is at least one warning or high-risk finding.

`info` findings never fail the job. The comment and annotations are published first, so the reason is on the pull request when the job turns red. With `dry-run: true`, the review is printed and the job still fails.

Because the configuration is read from the base commit, a pull request cannot lower its own threshold. The CLI applies the same setting and exits with status 1.

