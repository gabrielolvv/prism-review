// The areas the review groups findings by, in the order they are listed when equally severe.
// Kept apart from the rule modules, like ids.ts, so reporting does not import the rules.
export const areas = [
  { id: "secrets", title: "Secrets" },
  { id: "supply-chain", title: "Supply Chain" },
  { id: "infrastructure", title: "Infrastructure" },
  { id: "code", title: "Code" },
  { id: "tests", title: "Tests" },
  { id: "review-scope", title: "Review Scope" },
  { id: "other", title: "Other" }
] as const;

export type Area = (typeof areas)[number]["id"];

// A unit test checks that every registered rule has an area.
export const ruleAreas: Readonly<Record<string, Area>> = {
  "secret-in-diff": "secrets",
  "credential-file": "secrets",
  "hardcoded-jwt-secret": "secrets",
  "hardcoded-session-secret": "secrets",
  "secret-logging": "secrets",
  "url-credentials": "secrets",
  "dependency-risk": "supply-chain",
  "lockfile-source": "supply-chain",
  "lookalike-dependency": "supply-chain",
  "risky-dependency-version": "supply-chain",
  "stale-lockfile": "supply-chain",
  "unpinned-action": "supply-chain",
  "workflow-risk": "supply-chain",
  "remote-script": "supply-chain",
  "privileged-container": "infrastructure",
  "dockerfile-risk": "infrastructure",
  "public-exposure": "infrastructure",
  "insecure-infrastructure": "infrastructure",
  "kubernetes-rbac": "infrastructure",
  "file-permissions": "infrastructure",
  "destructive-migration": "infrastructure",
  "sql-injection": "code",
  "insecure-web-config": "code",
  "weak-crypto": "code",
  "xml-external-entities": "code",
  "mass-assignment": "code",
  redos: "code",
  "untrusted-input": "code",
  "risky-api": "code",
  "unescaped-html": "code",
  "timing-unsafe-comparison": "code",
  "postmessage-origin": "code",
  "nosql-injection": "code",
  "template-injection": "code",
  "prototype-pollution": "code",
  "ldap-xpath-injection": "code",
  "upload-filename": "code",
  "reflected-xss": "code",
  "log-injection": "code",
  "static-iv": "code",
  "plaintext-password": "code",
  "admin-route-auth": "code",
  "zip-slip": "code",
  "regex-injection": "code",
  "electron-security": "code",
  "unsafe-reflection": "code",
  "command-injection": "code",
  "weak-password-hashing": "code",
  "jwt-without-expiry": "code",
  "disabled-security-check": "code",
  "hidden-unicode": "code",
  "blanket-suppression": "code",
  "missing-tests": "tests",
  "skipped-tests": "tests",
  "incomplete-review": "review-scope",
  "large-diff": "review-scope",
  "oversized-patch": "review-scope",
  "sensitive-files": "review-scope",
  "config-change": "review-scope",
  "review-control-change": "review-scope"
};

export function areaOf(ruleId: string): Area {
  return Object.hasOwn(ruleAreas, ruleId) ? (ruleAreas[ruleId] ?? "other") : "other";
}
