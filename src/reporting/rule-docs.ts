// Where each rule and its options are described. A unit test checks that every registered rule has
// a section here and that each section is a heading in docs/configuration.md.
const docsUrl = "https://github.com/gabrielolvv/prism-review/blob/master/docs/configuration.md";

export const ruleSections: Readonly<Record<string, string>> = {
  "incomplete-review": "Rules Without Options",
  "secret-in-diff": "Secrets",
  "credential-file": "Credential Files",
  "hardcoded-jwt-secret": "Hardcoded JWT Secrets",
  "disabled-security-check": "Disabled Security Checks",
  "hidden-unicode": "Hidden Unicode",
  "large-diff": "Large Diff",
  "missing-tests": "Missing Tests",
  "skipped-tests": "Skipped Tests",
  "blanket-suppression": "Blanket Suppressions",
  "risky-api": "Risky APIs",
  "sql-injection": "SQL Injection",
  "insecure-web-config": "Insecure Web Configuration",
  "weak-crypto": "Weak Cryptography",
  "untrusted-input": "Untrusted Input",
  "xml-external-entities": "XML External Entities",
  "mass-assignment": "Mass Assignment",
  redos: "Regular Expression Denial of Service",
  "remote-script": "Remote Scripts",
  "workflow-risk": "Workflow Risk",
  "unpinned-action": "Unpinned Actions",
  "destructive-migration": "Destructive Migrations",
  "privileged-container": "Privileged Containers",
  "dockerfile-risk": "Dockerfile Risk",
  "public-exposure": "Public Exposure",
  "insecure-infrastructure": "Insecure Infrastructure",
  "kubernetes-rbac": "Kubernetes RBAC",
  "file-permissions": "File Permissions",
  "sensitive-files": "Sensitive Files",
  "config-change": "Rules Without Options",
  "review-control-change": "Review Control Changes",
  "lockfile-source": "Lockfile Sources",
  "lookalike-dependency": "Lookalike Dependencies",
  "risky-dependency-version": "Risky Dependency Versions",
  "stale-lockfile": "Stale Lockfiles",
  "dependency-risk": "Dependency Risk",
  "oversized-patch": "Rules Without Options"
};

export function ruleDocsUrl(ruleId: string): string | undefined {
  const section = Object.hasOwn(ruleSections, ruleId) ? ruleSections[ruleId] : undefined;
  return section === undefined ? undefined : `${docsUrl}#${headingAnchor(section)}`;
}

// The anchor GitHub gives a Markdown heading.
export function headingAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}
