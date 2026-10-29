import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { kubernetesRbacRule } from "../../src/rules/kubernetes-rbac.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return kubernetesRbacRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testKubernetesRbacReportsClusterWideGrants(): void {
  const [finding] = findings([
    added("k8s/rbac.yaml", [
      "apiVersion: rbac.authorization.k8s.io/v1",
      "kind: ClusterRoleBinding",
      "metadata:",
      "  name: ci-admin",
      "roleRef:",
      "  apiGroup: rbac.authorization.k8s.io",
      "  kind: ClusterRole",
      "  name: cluster-admin",
      "subjects:",
      "  - kind: Group",
      "    name: system:authenticated"
    ])
  ]);

  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Cluster-wide access granted");
  assert.deepEqual(finding?.lines, [8, 11]);
  assert.equal(
    finding?.message,
    "Lines 8, 11 change Kubernetes RBAC so that it binds the cluster-admin role, and grants a role to every user or to unauthenticated requests."
  );
}

export function testKubernetesRbacReportsWildcardsAndEscalation(): void {
  // Every verb on every resource is cluster-admin by another name.
  const everything = findings([
    added("charts/app/templates/role.yaml", ["kind: ClusterRole", "rules:", '  - apiGroups: ["*"]', '    resources: ["*"]', "    verbs:", '      - "*"'])
  ]);
  assert.equal(everything[0]?.severity, "high");
  assert.deepEqual(everything[0]?.lines, [4, 6]);

  // One wildcard, or verbs that let a role grant itself more, is a warning.
  const [finding] = findings([
    added("deploy/role.yml", [
      "kind: Role",
      "rules:",
      '  - apiGroups: [""]',
      "    resources: [configmaps]",
      "    verbs: [*]",
      '  - apiGroups: ["rbac.authorization.k8s.io"]',
      "    resources: [clusterroles]",
      "    verbs:",
      "      - bind",
      "      - escalate"
    ])
  ]);
  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [5, 9, 10]);
  assert.match(finding?.message ?? "", /allows every verb, and allows the escalate, bind, or impersonate verbs/);
}

export function testKubernetesRbacSkipsNarrowRolesAndOtherFiles(): void {
  const narrow = [
    "kind: Role",
    "rules:",
    '  - apiGroups: [""]',
    '    resources: ["pods", "pods/log"]',
    '    verbs: ["get", "list", "watch"]',
    "  # verbs: ['*']"
  ];
  assert.deepEqual(findings([added("k8s/role.yaml", narrow)]), []);

  // A Role named in a binding other than cluster-admin, and YAML that is not RBAC.
  assert.deepEqual(findings([added("k8s/binding.yaml", ["kind: RoleBinding", "roleRef:", "  kind: Role", "  name: pod-reader"])]), []);
  assert.deepEqual(findings([added("config/users.yml", ["admins:", "  - name: cluster-admin", "verbs: ['*']"])]), []);

  // A hunk inside an existing Role is recognized from the kind git shows as its context.
  const inside: ChangedFile = { path: "k8s/role.yaml", status: "modified", additions: 1, deletions: 0, patch: '@@ -5,2 +5,3 @@ kind: ClusterRole\n   - apiGroups: [""]\n+    verbs: ["*"]' };
  assert.deepEqual(findings([inside])[0]?.lines, [6]);

  const binding = ["kind: ClusterRoleBinding", "roleRef:", "  name: cluster-admin"];
  assert.deepEqual(findings([added("docs/rbac/example.yaml", binding)]), []);
  assert.deepEqual(findings([added("test/fixtures/rbac.yaml", binding)]), []);
  assert.deepEqual(findings([added("k8s/b.yaml", binding)], prismConfigSchema.parse({ rules: { kubernetesRbac: { enabled: false } } })), []);
}
