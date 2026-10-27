// Every registered rule's id, kept separate from the rule modules so the configuration schema
// can validate `severity` keys without importing the rules. A unit test keeps it in sync.
export const ruleIds: readonly string[] = [
  "incomplete-review",
  "secret-in-diff",
  "credential-file",
  "hidden-unicode",
  "large-diff",
  "missing-tests",
  "skipped-tests",
  "blanket-suppression",
  "risky-api",
  "remote-script",
  "workflow-risk",
  "unpinned-action",
  "destructive-migration",
  "sensitive-files",
  "config-change",
  "lockfile-source",
  "dependency-risk",
  "oversized-patch"
];
