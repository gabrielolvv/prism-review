import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { terraformSensitiveValueRule } from "../../src/rules/terraform-sensitive-value.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return terraformSensitiveValueRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const variable = (name: string, ...body: string[]) => [`variable "${name}" {`, ...body.map((line) => `  ${line}`), "}"];

export function testTerraformSensitiveValueReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/variables.tf", [
      ...variable("db_password", "type        = string", "description = \"Password for the admin user\""),
      ...variable("db_name", "type = string"),
      ...variable("github_token", "type = string")
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Terraform secret shown in plan output");
  assert.deepEqual(finding?.lines, [1, 8]);
  assert.equal(
    finding?.message,
    "In lines 1, 8, the change declares Terraform variables named for secrets without `sensitive = true`, so their values appear in `plan` and `apply` output, and in CI logs, wherever a resource uses them in a setting the provider does not hide: `db_password` and `github_token`."
  );
}

export function testTerraformSensitiveValueReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    // Secret names in snake case and upper case, and an empty block.
    ["infra/variables.tf", variable("slack_webhook_url", "type = string")],
    ["infra/variables.tf", ["variable \"UPCLOUD_PASSWORD\" {}"]],
    ["infra/variables.tf", variable("oidc_client_secret")],
    ["infra/variables.tf", variable("ssh_private_key", "default = \"\"")],
    // Redaction removed from a secret, as in Helm values.
    ["infra/argocd.tf", ["  set {", "    name  = \"configs.secret.githubSecret\"", "    value = nonsensitive(local.webhook_github_secret)", "  }"]],
    ["infra/outputs.tf", ["output \"admin_password\" {", "  value = nonsensitive(random_password.admin.result)", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testTerraformSensitiveValueSkipsMarkedAndNonSecretValues(): void {
  const cases: Array<[string, string[]]> = [
    // Marked variables, including one-line and ephemeral ones.
    ["infra/variables.tf", variable("db_password", "type      = string", "sensitive = true")],
    ["infra/variables.tf", ["variable \"api_token\" { sensitive = true }"]],
    ["infra/variables.tf", variable("registry_token", "type      = string", "ephemeral = true")],
    // Settings about a secret, and names that do not end in one.
    ["infra/variables.tf", variable("password_length", "type = number")],
    ["infra/variables.tf", variable("create_random_password", "type = bool")],
    ["infra/variables.tf", variable("secret_name", "type = string")],
    ["infra/variables.tf", variable("ssh_public_key", "type = string")],
    ["infra/variables.tf", variable("manage_master_user_password", "default = true")],
    ["infra/variables.tf", variable("github_token", "type        = string", "description = \"Name of the Secrets Manager secret that holds the token\"")],
    ["infra/variables.tf", variable("chamber_name_token", "description = \"Chamber parameter name that stores the account token\"")],
    // `nonsensitive()` on values that reveal nothing, or not on secrets.
    ["infra/main.tf", ["  for_each = nonsensitive(toset(keys(var.secrets)))"]],
    ["infra/main.tf", ["  count = nonsensitive(var.client_secret) == \"\" ? 1 : 0"]],
    ["infra/main.tf", ["  image_id = nonsensitive(data.aws_ssm_parameter.ami.value)"]],
    ["infra/main.tf", ["  # value = nonsensitive(var.db_password)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testTerraformSensitiveValueSkipsTestsAndCanBeDisabled(): void {
  const lines = variable("db_password", "type = string");
  assert.deepEqual(findings([added("test/fixtures/rds/variables.tf", lines)]), []);
  assert.deepEqual(findings([added("examples/complete/variables.tf", lines)]), []);
  assert.deepEqual(findings([added("enos/modules/vault_unseal/main.tf", lines)]), []);
  assert.deepEqual(findings([added("infra/terraform.tfvars", ["db_password = \"x\""])]), []);

  const config = prismConfigSchema.parse({ rules: { terraformSensitiveValue: { enabled: false } } });
  assert.deepEqual(findings([added("infra/variables.tf", lines)], config), []);
}
