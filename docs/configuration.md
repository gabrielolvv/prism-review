# Configuration

Prism Review reads `.prism-review.yml` from the repository root by default. Every option is optional; missing values fall back to the defaults shown below.

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

`upsert` is the recommended mode. It updates a previous Prism Review comment using a stable HTML marker.

`append` is reserved for future use.

### `comment.includeLowSeverity`

When `true`, `info` findings such as `oversized-patch` are rendered in the comment. They are hidden by default to keep the comment focused on warnings and high-risk findings.
