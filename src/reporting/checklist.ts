import type { Finding } from "../analysis/finding.js";
import { compareSeverity } from "../analysis/severity.js";
import { areaOf, areas } from "../rules/areas.js";

// A question for the reviewer about each rule's findings. A unit test checks that every
// registered rule has one.
export const ruleQuestions: Readonly<Record<string, string>> = {
  "secret-in-diff":
    "Has each credential added here been revoked and replaced? Removing it in a later commit leaves it in the Git history.",
  "credential-file": "Do the committed credential files belong in the repository, or in a secret store?",
  "hardcoded-jwt-secret": "Is each JWT key written in the code replaced by one from a secret store, and the committed key retired?",
  "secret-logging": "Do the new log lines write only that a secret was present, never its value?",
  "url-credentials": "Is each password found in a URL changed, and the URL now built from a secret at run time?",
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
  "untrusted-input": "Is each redirect target, outgoing URL, and file path from the request checked against what is allowed?",
  "weak-crypto": "Are secrets hashed with a password hash, encrypted with an authenticated cipher, and made with a cryptographic random generator?",
  "xml-external-entities": "Does every XML parser that turns on DTDs or external entities read only trusted documents?",
  "mass-assignment": "Does each form, serializer, or model write accept only the fields a user may change?",
  redos: "Can a user send the text these regular expressions read, and is its length limited?",
  "insecure-web-config": "Which origins may send credentials, and do the cookies and debug settings match production?",
  "risky-api": "Can input from users, files, or the network reach the flagged calls?",
  "unescaped-html": "Is every value written into the page without escaping either fixed text or sanitized first?",
  "timing-unsafe-comparison": "Are signatures, tokens, and keys compared in constant time?",
  "postmessage-origin": "Does every cross-window message name its target origin, and every handler check `event.origin`?",
  "nosql-injection": "Is every request value cast to text, or matched with `$eq`, before it reaches a MongoDB filter?",
  "template-injection": "Are templates kept in files or fixed text, with request values passed only as variables?",
  "prototype-pollution": "Do merges and assignments by key skip `__proto__`, `constructor`, and `prototype`?",
  "ldap-xpath-injection": "Is every value in an LDAP filter or XPath expression escaped or bound as a variable?",
  "upload-filename": "Are uploads stored under names the server makes, with their type checked?",
  "reflected-xss": "Is every request value escaped before it is written into an HTML response?",
  "log-injection": "Are line breaks removed from request values before they go into log text?",
  "static-iv": "Does every encryption use a new random IV or nonce?",
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
