import { minimatch } from "minimatch";
import type { ChangedFile, SecretMatch } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findAddedSecrets } from "../security/detect-secrets.js";
import { describeLines } from "./line-list.js";

export const secretInDiffRule: Rule = {
  id: "secret-in-diff",
  seesIgnoredFiles: true,
  description: "Flags added lines that contain a value in a known credential format.",
  run({ files, config }) {
    if (!config.rules.secretInDiff.enabled) {
      return [];
    }

    const allowlist = config.security.redaction.allowlist.map((source) => new RegExp(source));
    const testGlobs = config.rules.missingTests.testGlobs;

    return files
      .map((file) => ({ file, secrets: secretsIn(file, allowlist) }))
      .map(({ file, secrets }) => ({
        file,
        secrets: isSamplePath(file.path, testGlobs) ? secrets.filter((secret) => secret.kind !== "private key") : secrets
      }))
      .filter(({ secrets }) => secrets.length > 0)
      .map(({ file, secrets }) => ({
        ruleId: "secret-in-diff",
        title: "Possible secret added",
        severity: "high" as const,
        file: file.path,
        line: Math.min(...secrets.map((secret) => secret.line)),
        message: describe(
          secrets.map((secret) => secret.line),
          [...new Set(secrets.map((secret) => secret.kind))]
        ),
        recommendation:
          "Treat the credential as exposed: revoke or rotate it, remove it from the branch history, and load it from a secret store. If it is a known test value, add a pattern for it to security.redaction.allowlist."
      }));
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretsIn(file: ChangedFile, allowlist: RegExp[]): SecretMatch[] {
  if (file.secrets !== undefined) {
    return file.secrets;
  }

  return file.patch === undefined ? [] : findAddedSecrets(file.patch, allowlist);
}

// Tests, examples, and documentation that show TLS or signing generate a throwaway private key.
// Token formats are still reported there: a token opens a real account, while a test key signs nothing
// anyone trusts.
const sampleDirectory = /(?:^|\/)(?:examples?|samples?|demos?|docs?|test[-_]fixtures|_fixtures?|testcerts)\//i;
const documentation = /\.(?:md|mdx|markdown|rst|adoc|asciidoc)$/i;

function isSamplePath(path: string, testGlobs: string[]): boolean {
  return (
    isTestDataPath(path) ||
    sampleDirectory.test(path) ||
    documentation.test(path) ||
    testGlobs.some((glob) => minimatch(path, glob))
  );
}

function describe(lines: number[], kinds: string[]): string {
  const { text, plural } = describeLines(lines);
  if (!plural && kinds.length === 1) {
    return `${text} adds what looks like ${article(kinds[0] ?? "")} ${kinds[0]}. The value is redacted from this review.`;
  }

  return `${text} ${plural ? "add" : "adds"} values that look like credentials (${kinds.join(", ")}). The values are redacted from this review.`;
}

function article(kind: string): string {
  return /^[AEIOU]/i.test(kind) ? "an" : "a";
}
