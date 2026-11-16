import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { ciOidcTrustRule } from "../../src/rules/ci-oidc-trust.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return ciOidcTrustRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const jsonTrust = (...condition: string[]) => [
  "{",
  "  \"Version\": \"2012-10-17\",",
  "  \"Statement\": [",
  "    {",
  "      \"Effect\": \"Allow\",",
  "      \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com\" },",
  "      \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
  "      \"Condition\": {",
  ...condition,
  "      }",
  "    }",
  "  ]",
  "}"
];
const audience = "        \"StringEquals\": { \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\" }";

const terraformTrust = (...conditions: string[]) => [
  "data \"aws_iam_policy_document\" \"deploy_trust\" {",
  "  statement {",
  "    actions = [\"sts:AssumeRoleWithWebIdentity\"]",
  "    principals {",
  "      type        = \"Federated\"",
  "      identifiers = [aws_iam_openid_connect_provider.github.arn]",
  "    }",
  "    condition {",
  "      test     = \"StringEquals\"",
  "      variable = \"token.actions.githubusercontent.com:aud\"",
  "      values   = [\"sts.amazonaws.com\"]",
  "    }",
  ...conditions,
  "  }",
  "}"
];

export function testCiOidcTrustReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("iam/deploy-trust.json", jsonTrust(`${audience},`, "        \"StringLike\": { \"token.actions.githubusercontent.com:sub\": \"repo:*\" }"))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Cloud role trusts every CI pipeline");
  assert.deepEqual(finding?.lines, [10]);
  assert.equal(
    finding?.message,
    "Line 10 lets any GitHub repository assume this role, because the trust policy matches the subject `repo:*`, which allows every owner. Anyone can get such a token by running a pipeline in an account of their own, and then act with the role's permissions in this cloud account."
  );

  const [audienceOnly] = findings([added("iam/deploy-trust.json", jsonTrust(audience))]);
  assert.deepEqual(audienceOnly?.lines, [6]);
  assert.match(audienceOnly?.message ?? "", /checks only the token's audience or branch, not whose repository or project it comes from/);
}

export function testCiOidcTrustReadsEachFormat(): void {
  const cases: Array<[string, string[]]> = [
    // A trust policy with no condition at all.
    ["iam/trust.json", jsonTrust().filter((line) => !/Condition|^\s{6}\}$/.test(line)).map((line) => line.replace("AssumeRoleWithWebIdentity\",", "AssumeRoleWithWebIdentity\""))],
    // A condition on the branch only, which every repository has.
    ["iam/trust.json", jsonTrust(`${audience},`, "        \"StringEquals\": { \"token.actions.githubusercontent.com:ref\": \"refs/heads/main\" }")],
    // Terraform's policy documents, with the audience only, or a wildcard in the owner's name.
    ["infra/github.tf", terraformTrust()],
    [
      "infra/github.tf",
      terraformTrust("    condition {", "      test     = \"StringLike\"", "      variable = \"token.actions.githubusercontent.com:sub\"", "      values   = [\"repo:octo-org*/deploy:*\"]", "    }")
    ],
    // A condition block that lists its values before its test and variable.
    [
      "infra/github.tf",
      terraformTrust("    condition {", "      values   = [\"repo:*\"]", "      test     = \"StringLike\"", "      variable = \"token.actions.githubusercontent.com:sub\"", "    }")
    ],
    // jsonencode in a role.
    [
      "infra/role.tf",
      [
        "resource \"aws_iam_role\" \"deploy\" {",
        "  assume_role_policy = jsonencode({",
        "    Version = \"2012-10-17\"",
        "    Statement = [{",
        "      Effect    = \"Allow\"",
        "      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }",
        "      Action    = \"sts:AssumeRoleWithWebIdentity\"",
        "      Condition = {",
        "        StringLike = { \"token.actions.githubusercontent.com:sub\" = [\"repo:acme/web:*\", \"repo:*/infra:*\"] }",
        "      }",
        "    }]",
        "  })",
        "}"
      ]
    ],
    // CloudFormation, with a YAML list.
    [
      "cfn/github-role.yaml",
      [
        "Resources:",
        "  DeployRole:",
        "    Type: AWS::IAM::Role",
        "    Properties:",
        "      AssumeRolePolicyDocument:",
        "        Statement:",
        "          - Effect: Allow",
        "            Action: sts:AssumeRoleWithWebIdentity",
        "            Principal:",
        "              Federated: !Ref GithubOidc",
        "            Condition:",
        "              StringLike:",
        "                token.actions.githubusercontent.com:sub:",
        "                  - repo:*",
        "          - Effect: Allow",
        "            Action: sts:AssumeRoleWithWebIdentity",
        "            Principal:",
        "              Federated: !Ref GithubOidc",
        "            Condition:",
        "              StringLike:",
        "                token.actions.githubusercontent.com:sub: !Sub \"repo:*/${RepositoryName}:*\"",
        "  Bucket:",
        "    Type: AWS::S3::Bucket"
      ]
    ],
    // The AWS CDK, in TypeScript and Python.
    [
      "lib/deploy-stack.ts",
      [
        "const role = new iam.Role(this, 'Deploy', {",
        "  assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {",
        "    StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },",
        "  }),",
        "});"
      ]
    ],
    [
      "stacks/deploy.py",
      [
        "role = iam.Role(self, \"Deploy\",",
        "    assumed_by=iam.WebIdentityPrincipal(provider.open_id_connect_provider_arn, conditions={",
        "        \"StringLike\": {\"token.actions.githubusercontent.com:sub\": \"repo:*\"},",
        "    }),",
        ")"
      ]
    ],
    // GitLab.com, HCP Terraform, and Buildkite.
    [
      "iam/gitlab.json",
      [
        "{",
        "  \"Effect\": \"Allow\",",
        "  \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/gitlab.com\" },",
        "  \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
        "  \"Condition\": { \"StringEquals\": { \"gitlab.com:aud\": \"https://gitlab.com\" } }",
        "}"
      ]
    ],
    [
      "iam/tfc.json",
      [
        "{",
        "  \"Effect\": \"Allow\",",
        "  \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/app.terraform.io\" },",
        "  \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
        "  \"Condition\": { \"StringLike\": { \"app.terraform.io:sub\": \"organization:*:project:*:workspace:*:run_phase:*\" } }",
        "}"
      ]
    ],
    [
      "iam/buildkite.json",
      [
        "{",
        "  \"Effect\": \"Allow\",",
        "  \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/agent.buildkite.com\" },",
        "  \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
        "  \"Condition\": { \"StringEquals\": { \"agent.buildkite.com:aud\": \"sts.amazonaws.com\" } }",
        "}"
      ]
    ]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testCiOidcTrustSkipsNamedOwnersAndOtherIssuers(): void {
  const cases: Array<[string, string[]]> = [
    // Subjects that name the owner, also through templates and with a wildcard after it.
    ["iam/trust.json", jsonTrust(`${audience},`, "        \"StringLike\": { \"token.actions.githubusercontent.com:sub\": \"repo:acme/web:*\" }")],
    ["iam/trust.json", jsonTrust(`${audience},`, "        \"StringLike\": { \"token.actions.githubusercontent.com:sub\": [\"repo:acme/*\", \"repo:acme-labs/infra:ref:refs/heads/main\"] }")],
    ["iam/trust.json", jsonTrust(`${audience},`, "        \"StringEquals\": { \"token.actions.githubusercontent.com:repository_owner\": \"acme\" }")],
    ["infra/github.tf", terraformTrust("    condition {", "      test     = \"StringLike\"", "      variable = \"token.actions.githubusercontent.com:sub\"", "      values   = [\"repo:${var.github_org}/${var.repo}:*\"]", "    }")],
    // `*` is literal text under StringEquals, so it matches nothing.
    ["iam/trust.json", jsonTrust(`${audience},`, "        \"StringEquals\": { \"token.actions.githubusercontent.com:sub\": \"*\" }")],
    ["infra/github.tf", terraformTrust("    condition {", "      values   = [\"repo:*\"]", "      variable = \"token.actions.githubusercontent.com:sub\"", "      test     = \"StringEquals\"", "    }")],
    // CloudFormation parameters for the owner.
    [
      "cfn/github-role.yaml",
      [
        "        Statement:",
        "          - Effect: Allow",
        "            Action: sts:AssumeRoleWithWebIdentity",
        "            Principal:",
        "              Federated: !Ref GithubOidc",
        "            Condition:",
        "              StringLike:",
        "                token.actions.githubusercontent.com:sub: !Sub \"repo:${GitHubOrg}/${RepositoryName}:*\""
      ]
    ],
    // Conditions built from variables, or keyed by an issuer the diff does not name.
    ["infra/github.tf", [...terraformTrust().slice(0, 12), "    dynamic \"condition\" {", "      for_each = var.subject_conditions", "    }", "  }", "}"]],
    ["infra/github.tf", terraformTrust("    condition {", "      test     = \"StringLike\"", "      variable = \"${local.oidc_host}:sub\"", "      values   = var.subjects", "    }")],
    // EKS service accounts, a GitHub Enterprise issuer, and CircleCI's per-organization issuer.
    [
      "iam/irsa.json",
      [
        "{",
        "  \"Effect\": \"Allow\",",
        "  \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/ABC\" },",
        "  \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
        "  \"Condition\": { \"StringEquals\": { \"oidc.eks.us-east-1.amazonaws.com/id/ABC:aud\": \"sts.amazonaws.com\" } }",
        "}"
      ]
    ],
    [
      "iam/ghe.json",
      [
        "{",
        "  \"Effect\": \"Allow\",",
        "  \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com/acme\" },",
        "  \"Action\": \"sts:AssumeRoleWithWebIdentity\"",
        "}"
      ]
    ],
    // The identity provider itself, which trusts nothing on its own.
    ["infra/oidc.tf", ["resource \"aws_iam_openid_connect_provider\" \"github\" {", "  url            = \"https://token.actions.githubusercontent.com\"", "  client_id_list = [\"sts.amazonaws.com\"]", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }

  // An edit to a trust policy whose conditions are outside the diff.
  const edited: ChangedFile = {
    path: "iam/trust.json",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: [
      "@@ -4,6 +4,6 @@",
      "     {",
      "       \"Effect\": \"Allow\",",
      "-      \"Principal\": { \"Federated\": \"arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com\" },",
      "+      \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com\" },",
      "       \"Action\": \"sts:AssumeRoleWithWebIdentity\",",
      "       \"Condition\": {",
      "         \"StringEquals\": { \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\" },"
    ].join("\n")
  };
  assert.deepEqual(findings([edited]), []);
}

export function testCiOidcTrustSkipsTestsAndCanBeDisabled(): void {
  const lines = jsonTrust(audience);
  assert.deepEqual(findings([added("examples/github-oidc/trust.json", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/trust.json", lines)]), []);
  assert.deepEqual(findings([added("docs/trust.json", lines)]), []);
  assert.deepEqual(findings([added("iam/trust.md", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { ciOidcTrust: { enabled: false } } });
  assert.deepEqual(findings([added("iam/trust.json", lines)], config), []);
}
