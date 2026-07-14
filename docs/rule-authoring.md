# Rule Authoring

Rules are small modules that inspect changed files and return findings.

```ts
type Rule = {
  id: string;
  description: string;
  run(context: AnalysisContext): Finding[];
};
```

Good rules should be:

- Deterministic
- Easy to test with fixtures
- Configurable when thresholds or patterns may vary by team
- Specific about why a change deserves review attention

Avoid rules that generate noisy comments without a clear reviewer action.
