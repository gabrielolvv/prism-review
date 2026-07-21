# Architecture

Prism Review is built around a deterministic analysis engine.

The GitHub Action layer is responsible for reading inputs, fetching pull request files, and publishing a comment. The analysis layer is independent of GitHub, which makes it easy to test locally with diff fixtures.

## Core Flow

1. GitHub emits a `pull_request` event.
2. The action reads inputs and repository context.
3. The config loader validates `.prism-review.yml`.
4. The GitHub client fetches changed files.
5. Oversized patches are dropped and the remaining patches are redacted.
6. The analysis engine runs rule modules.
7. The Markdown renderer creates the review body.
8. The publisher creates or updates one PR comment.

## Build Outputs

| Directory | Produced by | Tracked | Purpose |
| --- | --- | --- | --- |
| `build/` | `npm run build` | No | Compiler output used by type checking and tests. |
| `dist/` | `npm run bundle` | Yes | Self-contained bundles executed by GitHub and the CLI. |

GitHub runs an action straight from the repository checkout and does not install dependencies, so `dist/` must contain everything the action imports. CI rebuilds the bundle and fails when the committed copy is stale.

## Design Principles

- Rules are pure functions.
- GitHub integration is kept at the edges.
- The deterministic core works without network access.
- AI should be optional and advisory.
- The bot should never execute untrusted repository code.

## Future GitHub App Mode

The Action version is the MVP. A later GitHub App can add webhooks, queues, Postgres-backed review history, and an organization dashboard without rewriting the analysis engine.
