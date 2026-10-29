import type { Finding } from "../analysis/finding.js";
import { compareSeverity } from "../analysis/severity.js";
import { areaOf, areas } from "../rules/areas.js";

// A question for the reviewer about each rule's findings. A unit test checks that every
// registered rule has one.
export const ruleQuestions: Readonly<Record<string, string>> = {
  "secret-in-diff":
    "Has each credential added here been revoked and replaced? Removing it in a later commit leaves it in the Git history.",
  "credential-file": "Do the committed credential files belong in the repository, or in a secret store?",
  "dependency-risk": "Are the new or updated dependencies necessary and trusted?",
  "lockfile-source": "Do the packages from other sources come from places the team trusts?",
  "lookalike-dependency": "Is each flagged dependency the package that was meant, and not a lookalike of a popular one?",
  "stale-lockfile": "Was the lockfile regenerated with the manifest, so the versions installed are the ones reviewed?",
  "risky-dependency-version":
    "Is each older or open-ended dependency version intended, and does a lockfile pin what is actually installed?",
  "unpinned-action": "Can the third-party actions be pinned to a full commit SHA?",
  "workflow-risk": "Can someone who opens a pull request or an issue change what the workflows run, or reach their secrets?",
  "remote-script": "Is each downloaded script checked against a known checksum or signature before it runs?",
  "privileged-container": "Does each container need the privileges it is given?",
  "dockerfile-risk": "Is each image pinned, run as a non-root user, and built without secrets in ENV or ARG?",
  "public-exposure": "Is everything opened to the internet meant to be public?",
  "file-permissions": "Does any file need to be writable by every user, or run with its owner's rights?",
  "kubernetes-rbac": "Does each service account need the roles it is bound to, and nothing cluster-wide?",
  "insecure-infrastructure":
    "Does each role need every action it is granted, and is turning off encryption, TLS 1.2, audit logs, or IMDSv2 intended?",
  "destructive-migration":
    "Is the affected data backed up, and can the migration be rolled back while the previous release is still running?",
  "sql-injection": "Is every value in the flagged queries passed as a parameter?",
  "weak-crypto": "Are secrets hashed with a password hash, encrypted with an authenticated cipher, and made with a cryptographic random generator?",
  "insecure-web-config": "Which origins may send credentials, and do the cookies and debug settings match production?",
  "risky-api": "Can input from users, files, or the network reach the flagged calls?",
  "disabled-security-check": "Is turning off each security check intended, and limited to where it is needed?",
  "hidden-unicode": "Do the lines with hidden characters do what they appear to do?",
  "blanket-suppression": "Can the blanket suppressions name the rules they skip?",
  "missing-tests": "Are tests covering the changed behavior?",
  "skipped-tests": "Will the focused or skipped tests be restored before merging?",
  "incomplete-review": "Who reviews the files that Prism Review could not see?",
  "large-diff": "Could this pull request be split into smaller ones?",
  "oversized-patch": "Has someone read the files too large for Prism Review to inspect?",
  "sensitive-files": "Are security-sensitive changes reviewed by the right owner?",
  "config-change": "Has someone who owns the review configuration approved the change to it?",
  "review-control-change":
    "Did the current owners of the affected paths approve the change to CODEOWNERS or to the files marked generated or vendored?"
};

// For a review without findings, or with only findings from rules that have no question.
export const defaultQuestions = [
  "Are tests covering the changed behavior?",
  "Are security-sensitive changes reviewed by the right owner?",
  "Are deployment, migration, or rollback risks understood?",
  "Are new dependencies necessary and trusted?"
];

const maxQuestions = 8;

// One question per rule, then the repository's own questions. Like the areas in the comment, the
// most severe findings come first, and equally severe ones keep the order of the areas.
export function checklistQuestions(findings: Finding[], extra: readonly string[] = []): string[] {
  const areaIndex = (finding: Finding) => areas.findIndex((area) => area.id === areaOf(finding.ruleId));
  const ordered = [...findings].sort(
    (left, right) => compareSeverity(left.severity, right.severity) || areaIndex(left) - areaIndex(right)
  );
  const asked = new Set<string>();
  for (const finding of ordered) {
    const question = Object.hasOwn(ruleQuestions, finding.ruleId) ? ruleQuestions[finding.ruleId] : undefined;
    if (question !== undefined && asked.size < maxQuestions) {
      asked.add(question);
    }
  }

  return [...(asked.size > 0 ? asked : defaultQuestions), ...extra];
}
