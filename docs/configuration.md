# Configuration

Prism Review reads `.prism-review.yml` from the repository root by default.

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
      - "src/**/*.ts"
      - "app/**/*.tsx"
    testGlobs:
      - "**/*.test.ts"
      - "**/*.spec.ts"
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
      - "go.mod"
      - "Cargo.toml"

comment:
  mode: "upsert"
  includeLowSeverity: false
```

## Comment Mode

`upsert` is the recommended mode. It updates a previous Prism Review comment using a stable HTML marker.

`append` is reserved for future use.
