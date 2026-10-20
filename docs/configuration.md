# Configuration

Prism Review reads `.prism-review.yml` from the repository root by default. Every option is optional; missing values fall back to the defaults shown below.

## Where the Configuration Comes From

The action reads the configuration from the **base commit** of the pull request through the GitHub contents API, not from the pull request itself. A pull request that edits the configuration is reviewed with the rules that were already merged, and the edit is reported by the `config-change` rule.

- `config-path` selects the file. It must be a relative path inside the repository; absolute paths and `..` segments fail the run.
- When the file does not exist on the base commit, the defaults apply and the log says so. This is the case for the pull request that first adds a configuration file, which also receives a high-risk `config-change` finding.
- The CLI reads the file from disk, because it analyzes local diff fixtures and has no base commit.

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
| PHPUnit, Pest | `->only()` | `$this->markTestSkipped(...)`, `$this->markTestIncomplete(...)`, `->skip(...)` |

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
| PHPStan, PHP_CodeSniffer, Psalm | `@phpstan-ignore-line`, `@phpstan-ignore-next-line`, `phpcs:ignore` or `phpcs:disable` with no sniff, `@codingStandardsIgnoreFile`, `@psalm-suppress all` | `@phpstan-ignore argument.type`, `phpcs:ignore Generic.Files.LineLength` |

Only added lines are checked, and each marker only counts in files of its own language: ESLint and TypeScript markers in JavaScript and TypeScript sources, Python markers in `.py` and `.pyi` files, and so on. A `#noqa` inside a URL in a `.ts` file is not a suppression, and documentation that quotes these markers is never reported.

## Risky APIs

### `rules.riskyApis.enabled`

The `risky-api` rule warns, with the first line number, when a pull request adds a call that runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML. These calls are not wrong in themselves, but a reviewer should check where their input comes from.

| Language | Reported | Not reported |
| --- | --- | --- |
| JavaScript, TypeScript | `eval(...)` and `window.eval(...)`, `new Function(...)`, `exec` and `execSync` from `child_process` (bare, or as `cp.`, `childProcess.`, or `child_process.`), a `shell: true` option, `dangerouslySetInnerHTML`, assignments to `innerHTML` or `outerHTML`, `document.write` | `pattern.exec(input)`, `execFile(...)`, `textContent =`, comparisons such as `innerHTML === x` |
| Python | `eval(...)`, `exec(...)`, `pickle`, `marshal`, and `shelve` loads, `yaml.load` and `yaml.load_all` without a safe loader on the same line, `yaml.unsafe_load`, `shell=True`, `os.system`, `os.popen` | `model.eval()`, `yaml.safe_load`, `yaml.load(..., Loader=yaml.SafeLoader)`, `json.loads`, `shell=False` |
| Go | `exec.Command` that runs a shell with a command string, such as `sh -c`, `/bin/bash -lc`, `cmd /C`, or `powershell -Command`, and `template.HTML(...)` | `exec.Command("git", "status")` |
| Ruby | `eval`, `instance_eval`, `class_eval`, and `module_eval` with a string, `system`, `exec`, and `spawn` with a string, `%x(...)` and backticks with interpolation, `Marshal.load`, `YAML.unsafe_load`, `.html_safe`, `raw(...)` | `calculator.eval(...)`, `def eval`, `YAML.safe_load` |
| Java, Kotlin | `Runtime.getRuntime().exec(...)`, `ProcessBuilder` that runs a shell with a command string, `ObjectInputStream`, `XMLDecoder` | `new ProcessBuilder("git", "status")` |
| PHP | `eval(...)`, `exec`, `shell_exec`, `system`, `passthru`, `popen`, `proc_open`, `unserialize(...)` | `$runner->exec(...)`, `Foo::exec(...)`, `function exec(...)`, `json_decode(...)` |

Only added lines are checked, and lines that define a function or method with one of these names, such as `def eval(self):` or a class method `exec(command) {`, are not reported. Files matched by `rules.missingTests.testGlobs` are skipped, because tests call these on purpose with fixed input, and only source files of the languages above are scanned.

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

## Check

### `check.failOn`

Fails the job when the review has a finding at or above this severity, so branch protection can require the check to pass before merging.

- `never` (default): the job passes whatever the review finds.
- `high`: the job fails when there is at least one high-risk finding.
- `warning`: the job fails when there is at least one warning or high-risk finding.

`info` findings never fail the job. The comment and annotations are published first, so the reason is on the pull request when the job turns red. With `dry-run: true`, the review is printed and the job still fails.

Because the configuration is read from the base commit, a pull request cannot lower its own threshold. The CLI applies the same setting and exits with status 1.

