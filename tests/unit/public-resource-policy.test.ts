import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { publicResourcePolicyRule } from "../../src/rules/public-resource-policy.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return publicResourcePolicyRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPublicResourcePolicyReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("policies/queue-policy.json", [
      "{",
      "  \"Version\": \"2012-10-17\",",
      "  \"Statement\": [",
      "    {",
      "      \"Effect\": \"Allow\",",
      "      \"Principal\": \"*\",",
      "      \"Action\": \"sqs:SendMessage\",",
      "      \"Resource\": \"arn:aws:sqs:us-east-1:123456789012:orders\"",
      "    }",
      "  ]",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Resource policy open to everyone");
  assert.deepEqual(finding?.lines, [6]);
  assert.equal(
    finding?.message,
    "Line 6 allows every principal, including anonymous callers and every other AWS account, with no condition, so anyone who learns the resource's name can change it, read its private data, or run it."
  );
}

export function testPublicResourcePolicyWarnsForReadOnlyAccess(): void {
  const [finding] = findings([
    added("infra/bucket-policy.yaml", [
      "PolicyDocument:",
      "  Statement:",
      "    - Effect: Allow",
      "      Principal: \"*\"",
      "      Action: s3:GetObject",
      "      Resource: !Sub \"${Bucket.Arn}/*\""
    ])
  ]);

  assert.equal(finding?.severity, "warning");
  assert.match(finding?.message ?? "", /can read it\.$/);
}

export function testPublicResourcePolicyReadsEachFormat(): void {
  const cases: Array<[string, string[]]> = [
    ["policies/key.json", ["{", "  \"Effect\": \"Allow\",", "  \"Principal\": {\"AWS\": \"*\"},", "  \"Action\": \"kms:*\"", "}"]],
    ["policies/key.json", ["{", "  \"Effect\": \"Allow\",", "  \"Principal\": {", "    \"AWS\": \"*\"", "  },", "  \"Action\": \"kms:Decrypt\"", "}"]],
    ["template.yaml", ["      - Effect: Allow", "        Principal:", "          AWS: \"*\"", "        Action: sns:Publish"]],
    [
      "infra/policy.tf",
      ["data \"aws_iam_policy_document\" \"bucket\" {", "  statement {", "    actions = [\"s3:PutObject\"]", "    principals {", "      type        = \"*\"", "      identifiers = [\"*\"]", "    }", "  }", "}"]
    ],
    ["infra/lambda.tf", ["resource \"aws_lambda_permission\" \"public\" {", "  action    = \"lambda:InvokeFunction\"", "  principal = \"*\"", "}"]],
    ["infra/stack.ts", ["bucket.addToResourcePolicy(new iam.PolicyStatement({", "  actions: ['s3:GetObject'],", "  principals: [new iam.AnyPrincipal()],", "}));"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicResourcePolicySkipsLimitedPolicies(): void {
  const cases: Array<[string, string[]]> = [
    // Deny statements, such as one that requires TLS.
    ["policies/bucket.json", ["{", "  \"Effect\": \"Deny\",", "  \"Principal\": \"*\",", "  \"Action\": \"s3:*\",", "  \"Condition\": {\"Bool\": {\"aws:SecureTransport\": \"false\"}}", "}"]],
    // Conditions that limit who gets access.
    ["policies/queue.json", ["{", "  \"Effect\": \"Allow\",", "  \"Principal\": \"*\",", "  \"Action\": \"sqs:SendMessage\",", "  \"Condition\": {\"ArnEquals\": {\"aws:SourceArn\": \"arn:aws:sns:us-east-1:123456789012:orders\"}}", "}"]],
    [
      "infra/policy.tf",
      ["  statement {", "    principals {", "      type        = \"*\"", "      identifiers = [\"*\"]", "    }", "    condition {", "      test     = \"StringEquals\"", "      variable = \"aws:PrincipalOrgID\"", "      values   = [var.org_id]", "    }", "  }"]
    ],
    ["infra/lambda.tf", ["resource \"aws_lambda_permission\" \"sns\" {", "  principal  = \"*\"", "  source_arn = aws_sns_topic.orders.arn", "}"]],
    ["infra/stack.ts", ["new iam.PolicyStatement({", "  principals: [new iam.AnyPrincipal()],", "  conditions: { StringEquals: { 'aws:PrincipalOrgID': orgId } },", "})"]],
    // Named principals.
    ["policies/bucket.json", ["{", "  \"Effect\": \"Allow\",", "  \"Principal\": {\"AWS\": \"arn:aws:iam::123456789012:root\"},", "  \"Action\": \"s3:GetObject\"", "}"]],
    ["infra/policy.tf", ["    principals {", "      type        = \"Service\"", "      identifiers = [\"cloudfront.amazonaws.com\"]", "    }"]],
    // Permissions for a Lambda function URL, docstrings, and descriptions that quote a policy.
    ["zappa/core.py", ["permission = {", "    \"Action\": \"lambda:InvokeFunctionUrl\",", "    \"Principal\": \"*\",", "    \"FunctionUrlAuthType\": \"NONE\",", "}"]],
    ["plugins/modules/s3_bucket.py", ["RETURN = r\"\"\"", "        \"Principal\": \"*\",", "\"\"\""]],
    ["package/crds/policies.yaml", ["                    to all anonymous users. Principal: \"*\""]],
    // Snapshots, examples, and documentation.
    ["test/__snapshots__/stack.test.ts.snap", ["  \"Principal\": \"*\","]],
    ["examples/public-bucket/main.tf", ["  principal = \"*\""]],
    ["docs/policies.md", ["  \"Principal\": \"*\","]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicResourcePolicySkipsTestsAndCanBeDisabled(): void {
  const lines = ["{", "  \"Effect\": \"Allow\",", "  \"Principal\": \"*\",", "  \"Action\": \"s3:GetObject\"", "}"];
  assert.deepEqual(findings([added("test/fixtures/policy.json", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { publicResourcePolicy: { enabled: false } } });
  assert.deepEqual(findings([added("policies/bucket.json", lines)], config), []);
}
