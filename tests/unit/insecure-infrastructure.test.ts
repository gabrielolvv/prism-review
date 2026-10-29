import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { insecureInfrastructureRule } from "../../src/rules/insecure-infrastructure.js";

function added(path: string, lines: string[]): ChangedFile {
  return {
    path,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n")
  };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return insecureInfrastructureRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testInsecureInfrastructureReportsTerraform(): void {
  const [finding, ...rest] = findings([
    added("infra/main.tf", [
      'data "aws_iam_policy_document" "admin" {',
      "  statement {",
      '    actions   = ["*"]',
      '    resources = ["*"]',
      "  }",
      "}",
      'resource "aws_db_instance" "main" {',
      "  storage_encrypted = false",
      "}",
      'resource "azurerm_storage_account" "logs" {',
      '  min_tls_version = "TLS1_0"',
      "}",
      'resource "aws_cloudtrail" "main" {',
      "  enable_logging = false",
      "}",
      'resource "aws_instance" "web" {',
      "  metadata_options {",
      '    http_tokens = "optional"',
      "  }",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Policy allows every action");
  assert.deepEqual(finding?.lines, [3, 8, 11, 14, 18]);
  assert.equal(
    finding?.message,
    "Lines 3, 8, 11, 14, 18 change infrastructure so that it allows every action in an IAM policy, turns off encryption, allows TLS 1.0 or 1.1, turns off audit logging, and allows the instance metadata service without a token (IMDSv1)."
  );
}

export function testInsecureInfrastructureReportsTemplatesAndPolicies(): void {
  const policy = findings([
    added("iam/admin-policy.json", ['{"Statement": [{', '  "Effect": "Allow",', '  "Action": "*",', '  "Resource": "*"', "}]}"])
  ]);
  assert.deepEqual(policy[0]?.lines, [3]);

  const template = findings([
    added("cloudformation/db.yaml", ["Resources:", "  Db:", "    Properties:", "      StorageEncrypted: false", "      HttpTokens: optional"])
  ]);
  assert.equal(template[0]?.severity, "warning");
  assert.deepEqual(template[0]?.lines, [4, 5]);

  // jsonencode() in Terraform writes keys without quotes.
  const encoded = findings([added("iam.tf", ["  policy = jsonencode({", '    Statement = [{ Effect = "Allow",', '      Action = "*",', '      Resource = "*" }]'])]);
  assert.deepEqual(encoded[0]?.lines, [3]);
}

export function testInsecureInfrastructureSkipsSafeSettings(): void {
  const safe = [
    // A guardrail that denies every action, scoped actions, and Resource "*" on its own.
    "statement {",
    '  effect  = "Deny"',
    '  actions = ["*"]',
    "}",
    'actions   = ["s3:*", "logs:CreateLogStream"]',
    'resources = ["*"]',
    "storage_encrypted = true",
    'min_tls_version   = "TLS1_2"',
    'minimum_tls_version = "1.2"',
    'http_tokens       = "required"',
    "# encrypted = false",
    "enable_logging = true"
  ];
  assert.deepEqual(findings([added("infra/main.tf", safe)]), []);

  // Snake_case Terraform settings in other YAML, such as an application's config, are not templates.
  assert.deepEqual(findings([added("config/app.yml", ["cache:", "  encrypted = false", "  enable_logging = false"])]), []);
  // Documentation, tests, fixtures, and the setting turned off.
  const lines = ["storage_encrypted = false"];
  assert.deepEqual(findings([added("docs/terraform.md", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/main.tf", lines)]), []);
  assert.deepEqual(
    findings([added("main.tf", lines)], prismConfigSchema.parse({ rules: { insecureInfrastructure: { enabled: false } } })),
    []
  );
}
