# Dogfooding

Prism Review should review its own pull requests.

## Why

Dogfooding proves the Action works in a real GitHub workflow and gives the README a credible demo path.

## Suggested First Dogfood PR

Create a branch that changes a dependency fixture or a small source file without changing tests.

```bash
git checkout -b dogfood/dependency-risk-demo
```

Make a tiny change to `fixtures/diffs/dependency-change.diff` or add a new fixture. Then open a pull request against `master`.

Expected result:

- The `Prism Review Dogfood` workflow runs.
- The bot posts one PR comment.
- The comment includes `dependency-risk` and/or `missing-tests` findings.
- Re-pushing to the branch updates the same comment instead of creating duplicates.
- Editing `.prism-review.yml` in the branch adds a `config-change` finding, while the review itself still uses the configuration on `master`.

## Review Checklist

- Confirm the workflow has `contents: read` and `pull-requests: write`. On a pull request, the comment endpoint checks the pull requests permission, so `issues: write` alone fails with `403 Resource not accessible by integration`.
- Confirm the comment contains `<!-- prism-review-comment -->`.
- Confirm no raw secret-like values appear in generated output.
- Confirm the finding is useful enough for a human reviewer to act on.
