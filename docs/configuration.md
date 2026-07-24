# Configuration

Prism Review reads `.prism-review.yml` from the repository root by default. Every option is optional; missing values fall back to the defaults shown below.

## Where the Configuration Comes From

The action reads the configuration from the **base commit** of the pull request through the GitHub contents API, not from the pull request itself. A pull request that edits the configuration is reviewed with the rules that were already merged, and the edit is reported by the `config-change` rule.

- `config-path` selects the file. It must be a relative path inside the repository; absolute paths and `..` segments fail the run.
- When the file does not exist on the base commit, the defaults apply and the log says so. This is the case for the pull request that first adds a configuration file.
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

security:
  maxPatchBytes: 200000
  redaction:
    allowlist: []

comment:
  mode: "upsert"
  includeLowSeverity: false
```

Invalid values fail the run with the file and the field that was rejected, for example `Invalid Prism Review configuration in .prism-review.yml at 1a2b3c4: risk.largeDiff.maxFiles: Number must be greater than 0`.

## Rules Without Options

- `config-change` always runs. It reports a high-risk finding when a pull request edits, deletes, or renames the file named by `config-path`.
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

- `upsert` (default) keeps a single review comment. It updates the most recent comment that carries the `<!-- prism-review-comment -->` marker, or creates one.
- `append` posts a new comment on every run, which keeps the history of reviews in the conversation at the cost of more notifications.

### `comment.includeLowSeverity`

When `true`, `info` findings such as `oversized-patch` are rendered in the comment. They are hidden by default to keep the comment focused on warnings and high-risk findings.
