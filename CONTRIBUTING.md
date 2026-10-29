# Contributing

Thanks for helping make Prism Review better. Reports of false positives and missed findings are as useful as code: each one becomes a test, so the next release gets it right.

## Reporting a False Positive or a Missed Finding

Open an issue with the [false positive or missed finding template](https://github.com/gabrielolvv/prism-review/issues/new?template=false-positive.yml). The smallest diff that shows the problem is the most helpful part. You can check it locally first:

```bash
git diff origin/main...HEAD | node dist/cli/main.cjs analyze --diff -
```

Remove credentials and private code from the diff before posting it. To report a vulnerability in Prism Review itself, follow [`SECURITY.md`](SECURITY.md) instead of opening an issue.

## Setting Up

Prism Review needs Node.js 24.

```bash
npm install
npm run typecheck
npm test
npm run test:action
```

`npm test` compiles into `build/` and runs the unit tests. `npm run test:action` runs the bundled action against a mocked GitHub API.

## Making a Change

1. Change the code in `src/` and add tests in `tests/unit/`, registered in `tests/run-tests.ts`.
2. Run `npm run typecheck`, `npm test`, and `npm run test:action`.
3. Run `npm run bundle` and commit `dist/` in its own commit. GitHub runs the committed bundles, and CI fails when they are out of date.
4. Describe the change under `## Unreleased` in `CHANGELOG.md`.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:` for new rules and options, `fix:` for wrong or missing findings, `docs:`, `build:` for `dist/`, and `test:`.

## Adding a Rule

[`docs/rule-authoring.md`](docs/rule-authoring.md) explains how rules work and how to handle untrusted pull request content. A new rule touches these places, and `npm test` fails when one is missing:

- `src/rules/<rule-id>.ts`, the rule itself
- `src/rules/ids.ts` and `src/rules/index.ts`, to register it
- `src/rules/areas.ts`, to group its findings in the comment
- `src/config/schema.ts`, for `rules.<ruleName>.enabled` and any options
- `src/reporting/checklist.ts`, for the reviewer checklist question
- `src/reporting/rule-docs.ts`, which links findings to the rule's section of `docs/configuration.md`
- `docs/configuration.md`, for that section, the example configuration, and the index of rules by area
- The "Current Rules" table in `README.md`

Good rules are deterministic, cheap to run on every line, and specific about what the reviewer should do. Patterns must run in linear time, since they read untrusted input.

### Checking for False Positives

Tests show that a rule finds what it should. To see what else it finds, run every rule over a directory of real code, such as unpacked npm, PyPI, or RubyGems packages, as if a pull request added each file:

```bash
npm run build
node scripts/scan-corpus.mjs path/to/packages report.json
```

It prints how many files each rule reports, and `report.json` shows the lines. Read through them before opening a pull request, and add the false positives you fix to `tests/unit/corpus-regressions.test.ts`.

Write test inputs so they do not contain the text they look for, for example `["ev", "al("].join("")`. Prism Review reviews its own pull requests, and a literal would be reported there.

## Pull Requests

Keep each pull request to one change, with its tests. Prism Review reviews every pull request in this repository, and its comment is a good list of what to double-check.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
