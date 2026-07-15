---
name: Dependency risk rule
about: Track dependency review improvements
title: "Add dependency risk rule"
labels: enhancement, rules
---

## Context

Dependency changes can introduce supply-chain, runtime, licensing, or lockfile consistency risks.

## Scope

- Detect dependency manifests and lockfiles.
- Provide ecosystem-specific reviewer guidance.
- Keep the rule configurable.
- Add fixture-based coverage.

## Acceptance Criteria

- [ ] Rule is configurable through `.prism-review.yml`.
- [ ] Findings include useful reviewer guidance.
- [ ] Tests cover at least one dependency-change fixture.
- [ ] README and config docs mention the rule.
