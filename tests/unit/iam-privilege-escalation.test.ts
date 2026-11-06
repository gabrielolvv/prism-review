import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { iamPrivilegeEscalationRule } from "../../src/rules/iam-privilege-escalation.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return iamPrivilegeEscalationRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testIamPrivilegeEscalationReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("policies/deployer.json", [
      "{",
      "  \"Version\": \"2012-10-17\",",
      "  \"Statement\": [",
      "    {",
      "      \"Effect\": \"Allow\",",
      "      \"Action\": [",
      "        \"lambda:UpdateFunctionCode\",",
      "        \"iam:PassRole\",",
      "        \"iam:AttachRolePolicy\"",
      "      ],",
      "      \"Resource\": \"*\"",
      "    }",
      "  ]",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "IAM policy allows privilege escalation");
  assert.deepEqual(finding?.lines, [8, 9]);
  assert.equal(
    finding?.message,
    "Lines 8, 9 allow `iam:PassRole` and `iam:AttachRolePolicy` on every resource with no condition, so whoever holds this policy, or takes over what runs with it, can attach an administrator policy, create keys for other users, or pass and assume a more powerful role, and make themselves an administrator of the account."
  );
}

export function testIamPrivilegeEscalationReadsEachFormat(): void {
  const cases: Array<[string, string[]]> = [
    ["infra/iam.tf", ["data \"aws_iam_policy_document\" \"ci\" {", "  statement {", "    actions   = [\"iam:CreatePolicyVersion\", \"iam:SetDefaultPolicyVersion\"]", "    resources = [\"*\"]", "  }", "}"]],
    ["infra/iam.tf", ["  policy = jsonencode({", "    Statement = [{", "      Effect   = \"Allow\"", "      Action   = [\"iam:*\"]", "      Resource = \"*\"", "    }]", "  })"]],
    ["template.yaml", ["      PolicyDocument:", "        Statement:", "          - Effect: Allow", "            Action:", "              - iam:CreateAccessKey", "              - 'iam:PutUserPolicy'", "            Resource: '*'"]],
    ["infra/stack.ts", ["role.addToPolicy(new iam.PolicyStatement({", "  actions: ['sts:AssumeRole'],", "  resources: ['*'],", "}));"]],
    ["policies/admin-roles.json", ["{", "  \"Effect\": \"Allow\",", "  \"Action\": \"iam:PassRole\",", "  \"Resource\": \"arn:aws:iam::123456789012:role/*\"", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testIamPrivilegeEscalationSkipsLimitedStatements(): void {
  const cases: Array<[string, string[]]> = [
    // Named resources.
    ["policies/deployer.json", ["{", "  \"Effect\": \"Allow\",", "  \"Action\": \"iam:PassRole\",", "  \"Resource\": \"arn:aws:iam::123456789012:role/lambda-exec\"", "}"]],
    ["infra/iam.tf", ["  statement {", "    actions   = [\"sts:AssumeRole\"]", "    resources = [aws_iam_role.deploy.arn]", "  }"]],
    // Conditions, such as the service a role may be passed to.
    [
      "policies/karpenter.json",
      ["{", "  \"Effect\": \"Allow\",", "  \"Action\": \"iam:PassRole\",", "  \"Resource\": \"*\",", "  \"Condition\": { \"StringEquals\": { \"iam:PassedToService\": \"ec2.amazonaws.com\" } }", "}"]
    ],
    // Deny statements, read-only IAM actions, and trust policies' own `sts:AssumeRole`.
    ["policies/guard.json", ["{", "  \"Effect\": \"Deny\",", "  \"Action\": [\"iam:AttachUserPolicy\", \"iam:PutUserPolicy\"],", "  \"Resource\": \"*\"", "}"]],
    ["policies/read.json", ["{", "  \"Effect\": \"Allow\",", "  \"Action\": [\"iam:GetRole\", \"iam:ListRoles\"],", "  \"Resource\": \"*\"", "}"]],
    ["infra/role.tf", ["  assume_role_policy = jsonencode({", "    Statement = [{", "      Action    = \"sts:AssumeRole\"", "      Principal = { Service = \"lambda.amazonaws.com\" }", "    }]", "  })"]],
    // A Terraform dynamic statement next to a statement on every resource.
    [
      "modules/iam-group/main.tf",
      ["    content {", "      actions   = [\"iam:ListRoles\"]", "      resources = [\"*\"]", "    }", "  dynamic \"statement\" {", "    content {", "      actions   = [\"iam:CreateAccessKey\"]", "      resources = local.user_resources", "    }", "  }"]
    ],
    // Examples, snapshots, and documentation.
    ["examples/admin/policy.json", ["{", "  \"Action\": \"iam:*\",", "  \"Resource\": \"*\"", "}"]],
    ["test/__snapshots__/stack.test.ts.snap", ["  \"Action\": \"iam:*\",", "  \"Resource\": \"*\""]],
    ["docs/iam.md", ["  \"Action\": \"iam:*\",", "  \"Resource\": \"*\""]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testIamPrivilegeEscalationSkipsTestsAndCanBeDisabled(): void {
  const lines = ["{", "  \"Action\": \"iam:*\",", "  \"Resource\": \"*\"", "}"];
  assert.deepEqual(findings([added("test/fixtures/policy.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { iamPrivilegeEscalation: { enabled: false } } });
  assert.deepEqual(findings([added("policies/admin.json", lines)], config), []);
}
