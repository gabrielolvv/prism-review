# Sample Review Comment

Generated with `npm run analyze:fixture`, which reviews `fixtures/diffs/risky-auth-change.diff`.

```md
<!-- prism-review-comment -->

## Prism Review

Risk level: **High**

### Summary

Reviewed 2 changed file(s). Found 1 high-risk and 2 warning-level signal(s).

### Findings

#### High - Sensitive file changed

This file touches an area that commonly affects security, deployment, data integrity, or access control.

File: `src/auth/session.ts`

Recommendation: Ask for focused review from someone familiar with this area and verify rollback or mitigation steps.

#### Warning - Source changed without tests

Source files changed, but no test files were modified in this pull request.

Recommendation: Add or update tests for the modified behavior, or explain why existing coverage is sufficient.

#### Warning - Dependency definition changed

This file changes Node.js dependency metadata or lockfile state.

File: `package.json`

Recommendation: Verify package provenance, lockfile consistency, license impact, and whether the dependency is required at runtime.

### Suggested Review Checklist

- Are tests covering the changed behavior?
- Are security-sensitive changes reviewed by the right owner?
- Are deployment, migration, or rollback risks understood?
- Are new dependencies necessary and trusted?
```
