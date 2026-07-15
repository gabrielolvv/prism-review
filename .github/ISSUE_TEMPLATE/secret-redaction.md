---
name: Secret redaction
about: Track redaction of secrets from diffs and generated review content
title: "Add secret redaction before review enrichment"
labels: enhancement, security
---

## Context

Pull request diffs can accidentally contain secrets. Prism Review should redact sensitive values before any feature logs, comments on, or sends diff content to an AI provider.

## Acceptance Criteria

- [ ] Token-like values are redacted from patch content.
- [ ] Redaction is deterministic and covered by tests.
- [ ] Redaction does not mutate the original analysis inputs unexpectedly.
- [ ] Security docs explain the boundary.
