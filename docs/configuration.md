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
```

Invalid values fail the run with the file and the field that was rejected, for example `Invalid Prism Review configuration in .prism-review.yml at 1a2b3c4: risk.largeDiff.maxFiles: Number must be greater than 0`.

## Secrets

### `rules.secretInDiff.enabled`

The `secret-in-diff` rule reports a high-risk finding, with the line number, when an added line contains a value in a format specific enough to be a real credential:

- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)
- OpenAI-style API keys (`sk-`)
- AWS access key IDs (`AKIA`)
- Private key headers (`-----BEGIN ... PRIVATE KEY-----`)

Removed and unchanged lines are not reported. Broader patterns, such as long base64 strings and `password: ...` assignments, are still redacted but not reported, because lockfile hashes and type declarations would make them noisy.

The value never appears in the finding, the comment, or the annotation. Values matched by `security.redaction.allowlist` are neither redacted nor reported, which is how to keep a known test value from being flagged.

## Rules Without Options

- `config-change` always runs. It reports a high-risk finding when a pull request adds, edits, deletes, or renames the file named by `config-path`.
- `oversized-patch` always runs. It reports an `info` finding for each file whose patch exceeded `security.maxPatchBytes`.

## Security

### `security.maxPatchBytes`

Maximum size, in UTF-8 bytes, of a single file patch. Larger patches are dropped before redaction and analysis, and the file is reported by the `oversized-patch` rule as an `info` finding.

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
