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

## Review Checklist

- Confirm the workflow has `contents: read`, `pull-requests: read`, and `issues: write`.
- Confirm the comment contains `<!-- prism-review-comment -->`.
- Confirm no raw secret-like values appear in generated output.
- Confirm the finding is useful enough for a human reviewer to act on.
