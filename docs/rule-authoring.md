# Rule Authoring

Rules are small modules that inspect changed files and return findings.

```ts
type AnalysisContext = {
  files: ChangedFile[];
  config: PrismConfig;
  configPath: string;
};

type Rule = {
  id: string;
  description: string;
  run(context: AnalysisContext): Finding[];
};
```

Renamed files carry `previousPath`, so a rule that tracks a specific file should check both paths.

Register new rules in `src/rules/index.ts`.

Good rules should be:

- Deterministic
- Easy to test with fixtures
- Configurable when thresholds or patterns may vary by team
- Specific about why a change deserves review attention

Avoid rules that generate noisy comments without a clear reviewer action.
