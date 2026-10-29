# Security Policy

Prism Review reads untrusted pull request content and runs with a GitHub token, so reports about ways around its protections are welcome.

## Supported Versions

Fixes are released for the latest 0.x version, which the moving `v0` tag points to. Pin a release commit or use `@v0` to receive them.

## Reporting a Vulnerability

Report it privately through [GitHub's private vulnerability reporting](https://github.com/gabrielolvv/prism-review/security/advisories/new), not in a public issue. Include the version, the configuration, and a pull request diff or steps that show the problem.

Fixes are announced in a GitHub security advisory and in `CHANGELOG.md`.

## In Scope

- Pull request content, such as file names, diffs, or comments, that adds workflow commands, Markdown, or mentions to the review comment, the job summary, annotations, or review comments
- Ways for a pull request to hide findings from the review, suppress security rules, or change the configuration used to review it
- Credentials that reach the output, the logs, or the optional AI summary's request despite redaction
- Input that makes a rule take much longer than linear time
- Ways for the AI summary to change the risk level, the findings, or `check.failOn`

False positives and missed findings of a rule are bugs, not vulnerabilities: open an issue for them.
