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

Set `line` on a finding when it points at a specific line of the new file. The comment shows it next to the path, and annotations attach to it. `src/security/detect-secrets.ts` shows how to number added lines from the hunk headers.

Rules see patches after redaction. A rule that needs the original values, as `secret-in-diff` does, must collect what it needs in `src/security/prepare-changed-files.ts` before redaction runs, and keep only non-sensitive facts such as line numbers on the changed file.

Register new rules in `src/rules/index.ts`.

## Untrusted Content

File paths, patches, and anything else taken from the pull request are written by its author. Put a path in `file`, not in `title`, `message`, or `recommendation`:

- The comment renderer shows `file` in a code span sized to the path, with newlines spelled out, so it cannot add headings, HTML, @mentions, or issue references to the comment.
- Annotations attach to `file` directly, so a message such as "This file touches..." reads naturally beside it.

The renderer treats `title`, `message`, and `recommendation` as plain text: it escapes Markdown and HTML and folds newlines into spaces. That is a backstop, not a reason to interpolate pull request content into prose.

Good rules should be:

- Deterministic
- Easy to test with fixtures
- Configurable when thresholds or patterns may vary by team
- Specific about why a change deserves review attention

Avoid rules that generate noisy comments without a clear reviewer action.
