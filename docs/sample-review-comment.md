# Sample Review Comment

Generated with `npm run analyze:fixture`, which reviews `fixtures/diffs/risky-auth-change.diff`.

```md
<!-- prism-review-comment -->

## Prism Review

Risk level: **High**

### Summary

Reviewed 2 changed file(s). Found 1 high-risk and 3 warning-level signal(s).

### Findings

4 findings in 3 areas: Review Scope (1), Supply Chain (2), Tests (1).

### Review Scope (1)

#### High - Sensitive file changed

This file touches an area that commonly affects security, deployment, data integrity, or access control.

File: `src/auth/session.ts`

Recommendation: Ask for focused review from someone familiar with this area and verify rollback or mitigation steps.

Rule: [`sensitive-files`](https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md#sensitive-files)

### Supply Chain (2)

#### Warning - Lockfile not updated

This file changes dependencies (left-pad added), but package-lock.json, which pins the versions that are installed, is not part of this pull request.

File: `package.json`, line 12

Recommendation: Run the package manager's install or lock command and commit the updated lockfile, so CI and other developers install the reviewed versions.

Rule: [`stale-lockfile`](https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md#stale-lockfiles)

#### Warning - Dependency definition changed

This file changes Node.js dependency metadata or lockfile state.

File: `package.json`

Recommendation: Verify package provenance, lockfile consistency, license impact, and whether the dependency is required at runtime.

Rule: [`dependency-risk`](https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md#dependency-risk)

### Tests (1)

#### Warning - Source changed without tests

Source files changed, but no test files were modified in this pull request.

Recommendation: Add or update tests for the modified behavior, or explain why existing coverage is sufficient.

Rule: [`missing-tests`](https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md#missing-tests)

### Dependency Changes

| File | Package | Change |
| --- | --- | --- |
| `package.json` | `left-pad` | added `^1.3.0` |

### Suggested Review Checklist

- Are security-sensitive changes reviewed by the right owner?
- Was the lockfile regenerated with the manifest, so the versions installed are the ones reviewed?
- Are the new or updated dependencies necessary and trusted?
- Are tests covering the changed behavior?
```
