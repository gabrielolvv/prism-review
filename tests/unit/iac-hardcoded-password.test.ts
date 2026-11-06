import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { iacHardcodedPasswordRule } from "../../src/rules/iac-hardcoded-password.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return iacHardcodedPasswordRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const rds = (...attributes: string[]) => ["resource \"aws_db_instance\" \"orders\" {", "  engine         = \"postgres\"", "  instance_class = \"db.t3.medium\"", "  username       = \"orders\"", ...attributes, "}"];

export function testIacHardcodedPasswordReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("infra/rds.tf", rds("  password       = \"Tr0ub4dor-staging\""))]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Password written into infrastructure code");
  assert.deepEqual(finding?.lines, [5]);
  assert.equal(
    finding?.message,
    "Line 5 writes `password` into infrastructure code in plain text, so the value is committed to the repository, where anyone who can read it, a fork, or its history can use it, and stays the same in every environment built from it."
  );
  assert.doesNotMatch(finding?.message ?? "", /Tr0ub4dor/);
}

export function testIacHardcodedPasswordReadsEachFormat(): void {
  const cases: Array<[string, string[]]> = [
    ["infra/sql.tf", ["resource \"azurerm_mssql_server\" \"main\" {", "  administrator_login_password = \"Tr0ub4dor-staging\"", "}"]],
    ["infra/variables.tf", ["variable \"db_password\" {", "  type      = string", "  sensitive = true", "  default   = \"Tr0ub4dor-staging\"", "}"]],
    ["infra/prod.tfvars", ["db_password = \"Tr0ub4dor-staging\""]],
    ["live/prod/rds/terragrunt.hcl", ["inputs = {", "  master_password = \"Tr0ub4dor-staging\"", "}"]],
    ["infra/database.yaml", ["AWSTemplateFormatVersion: \"2010-09-09\"", "Resources:", "  Database:", "    Type: AWS::RDS::DBInstance", "    Properties:", "      MasterUserPassword: Tr0ub4dor-staging"]],
    ["infra/database.yaml", ["Parameters:", "  DBPassword:", "    Type: String", "    NoEcho: true", "    Default: Tr0ub4dor-staging", "Resources:", "  Database:", "    Type: AWS::RDS::DBInstance"]],
    ["infra/database.json", ["{", "  \"Resources\": {", "    \"Database\": {", "      \"Type\": \"AWS::RDS::DBInstance\",", "      \"Properties\": {", "        \"MasterUserPassword\": \"Tr0ub4dor-staging\"", "      }", "    }", "  }", "}"]],
    ["ansible/group_vars/db.yml", ["postgresql_admin_password: Tr0ub4dor-staging"]],
    ["ansible/inventory/hosts.ini", ["[web]", "web1.acme.io ansible_user=deploy ansible_password=Tr0ub4dor-staging"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testIacHardcodedPasswordSkipsReferencesAndPlaceholders(): void {
  const cases: Array<[string, string[]]> = [
    // Variables, generated passwords, secret store references, and dynamic references.
    ["infra/rds.tf", rds("  password       = var.db_password")],
    ["infra/rds.tf", rds("  password       = \"${random_password.db.result}\"")],
    ["infra/rds.tf", rds("  manage_master_user_password = true")],
    ["infra/variables.tf", ["variable \"db_password\" {", "  type      = string", "  sensitive = true", "}"]],
    ["infra/database.yaml", ["Resources:", "  Database:", "    Type: AWS::RDS::DBInstance", "    Properties:", "      MasterUserPassword: !Ref DBPassword"]],
    ["infra/database.yaml", ["Resources:", "  Database:", "    Type: AWS::RDS::DBInstance", "    Properties:", "      MasterUserPassword: \"{{resolve:secretsmanager:prod/db:SecretString:password}}\""]],
    ["ansible/group_vars/db.yml", ["postgresql_admin_password: !vault |", "  $ANSIBLE_VAULT;1.1;AES256"]],
    ["ansible/group_vars/db.yml", ["postgresql_admin_password: \"{{ vault_postgresql_admin_password }}\""]],
    // Placeholders, local defaults, settings about passwords, and other attributes.
    ["infra/rds.tf", rds("  password       = \"changeme\"")],
    ["infra/rds.tf", rds("  password       = \"postgres\"")],
    ["infra/iam.tf", ["resource \"aws_iam_account_password_policy\" \"strict\" {", "  minimum_password_length = 14", "  require_symbols         = true", "}"]],
    ["infra/secrets.tf", ["resource \"aws_secretsmanager_secret\" \"db\" {", "  name = \"prod/db-password\"", "}"]],
    // Variables that name where a secret is kept, time units, and test values.
    ["infra/variables.tf", ["variable \"ssm_key_password\" {", "  type    = string", "  default = \"admin/db_password\"", "}"]],
    ["infra/variables.tf", ["variable \"kube_secret\" {", "  type        = string", "  default     = \"tailscale\"", "  description = \"Kube Secret Name for tailscale\"", "}"]],
    ["infra/cognito.tf", ["  token_validity_units {", "    access_token  = \"minutes\"", "    refresh_token = \"days\"", "  }"]],
    ["infra/users.tf", ["  user_password = \"passtestuser1\""]],
    // Inline code in CloudFormation, and Ansible inventory plugins.
    ["infra/config.yaml", ["Resources:", "  Rule:", "    Type: AWS::Lambda::Function", "    Properties:", "      Code:", "        ZipFile: |", "          ResultToken: event.resultToken"]],
    ["plugins/inventory/cloud.py", ["        token=api_token,"]],
    // YAML that is not CloudFormation, and Ansible role defaults.
    ["config/app.yaml", ["database:", "  password: Tr0ub4dor-staging"]],
    ["roles/db/defaults/main.yml", ["postgresql_admin_password: Tr0ub4dor-staging"]],
    // Examples, tests, and documentation.
    ["examples/complete/main.tf", rds("  password       = \"Tr0ub4dor-staging\"")],
    ["docs/rds.md", rds("  password       = \"Tr0ub4dor-staging\"")]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testIacHardcodedPasswordFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `password = "..."`, so the value is read first.
  const files = prepareChangedFiles([added("infra/rds.tf", rds("  password       = \"Tr0ub4dor-staging\""))], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "iac-hardcoded-password");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [5]);
}

export function testIacHardcodedPasswordSkipsTestsAndCanBeDisabled(): void {
  const lines = rds("  password       = \"Tr0ub4dor-staging\"");
  assert.deepEqual(findings([added("test/fixtures/rds.tf", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { iacHardcodedPassword: { enabled: false } } });
  assert.deepEqual(findings([added("infra/rds.tf", lines)], config), []);
}
