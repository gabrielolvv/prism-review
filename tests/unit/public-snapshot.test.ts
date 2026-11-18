import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { publicSnapshotRule } from "../../src/rules/public-snapshot.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return publicSnapshotRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPublicSnapshotReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/backups.tf", [
      "resource \"aws_db_snapshot\" \"orders\" {",
      "  db_instance_identifier = aws_db_instance.orders.identifier",
      "  db_snapshot_identifier = \"orders-nightly\"",
      "  shared_accounts        = [\"all\"]",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Image or snapshot shared with everyone");
  assert.deepEqual(finding?.lines, [4]);
  assert.equal(finding?.message, "In line 4, the change shares a database snapshot with every AWS account, so anyone can restore it and read the data.");

  const [image] = findings([added("packer/app.pkr.hcl", ["source \"amazon-ebs\" \"app\" {", "  ami_name   = \"app-{{timestamp}}\"", "  ami_groups = [\"all\"]", "}"])]);
  assert.equal(image?.severity, "warning");
}

export function testPublicSnapshotReadsEachForm(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    // Packer, in JSON, and its snapshot setting.
    ["packer/app.json", ["{", "  \"builders\": [{", "    \"type\": \"amazon-ebs\",", "    \"snapshot_groups\": [\"all\"]", "  }]", "}"], "high"],
    // Terraform's launch permission and EC2 Image Builder.
    ["infra/ami.tf", ["resource \"aws_ami_launch_permission\" \"public\" {", "  image_id = aws_ami.app.id", "  group    = \"all\"", "}"], "warning"],
    ["infra/builder.tf", ["  distribution {", "    ami_distribution_configuration {", "      launch_permission {", "        user_groups = [\"all\"]", "      }", "    }", "  }"], "warning"],
    ["cfn/builder.yaml", ["          AmiDistributionConfiguration:", "            LaunchPermissionConfiguration:", "              UserGroups:", "                - all"], "warning"],
    // The AWS CLI, across continued lines, and PowerShell.
    ["scripts/publish.sh", ["aws ec2 modify-snapshot-attribute \\", "  --snapshot-id \"$SNAPSHOT_ID\" \\", "  --attribute createVolumePermission \\", "  --operation-type add --group-names all"], "high"],
    ["scripts/publish.sh", ["aws ec2 modify-image-attribute --image-id \"$AMI\" --launch-permission \"Add=[{Group=all}]\""], "warning"],
    ["scripts/share.sh", ["aws rds modify-db-cluster-snapshot-attribute --db-cluster-snapshot-identifier nightly --attribute-name restore --values-to-add all"], "high"],
    ["scripts/Publish.ps1", ["Edit-EC2ImageAttribute -ImageId $ami -Attribute launchPermission -OperationType add -UserGroup all"], "warning"],
    // SDK calls in Python, Go, and JavaScript.
    ["tools/share.py", ["ec2.modify_snapshot_attribute(", "    SnapshotId=snapshot_id,", "    Attribute=\"createVolumePermission\",", "    OperationType=\"add\",", "    GroupNames=[\"all\"],", ")"], "high"],
    [
      "pkg/aws/images.go",
      ["\t_, err = a.ec2.ModifyImageAttribute(&ec2.ModifyImageAttributeInput{", "\t\tLaunchPermission: &ec2.LaunchPermissionModifications{", "\t\t\tAdd: []*ec2.LaunchPermission{", "\t\t\t\t{Group: aws.String(\"all\")},", "\t\t\t},", "\t\t},", "\t})"],
      "warning"
    ],
    ["src/share.ts", ["await rds.send(new ModifyDBSnapshotAttributeCommand({", "  DBSnapshotIdentifier: id,", "  AttributeName: \"restore\",", "  ValuesToAdd: [\"all\"],", "}));"], "high"],
    // An Azure Compute Gallery shared with the community.
    ["infra/gallery.tf", ["resource \"azurerm_shared_image_gallery\" \"images\" {", "  sharing {", "    permission = \"Community\"", "  }", "}"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }

  // An image published with its own snapshot, as operating system publishers do.
  const [published] = findings([
    added("scripts/publish.sh", [
      "aws ec2 modify-snapshot-attribute --snapshot-id \"$SNAP\" --attribute createVolumePermission --operation-type add --group-names all",
      "aws ec2 modify-image-attribute --image-id \"$AMI\" --launch-permission \"Add=[{Group=all}]\""
    ])
  ]);
  assert.equal(published?.severity, "warning");
  assert.deepEqual(published?.lines, [1, 2]);
}

export function testPublicSnapshotSkipsAccountsAndRemovals(): void {
  const cases: Array<[string, string[]]> = [
    // Sharing with named accounts.
    ["infra/backups.tf", ["resource \"aws_db_snapshot\" \"orders\" {", "  shared_accounts = [\"123456789012\"]", "}"]],
    ["packer/app.pkr.hcl", ["  ami_users  = [\"123456789012\"]", "  ami_groups = var.ami_groups"]],
    ["scripts/share.sh", ["aws ec2 modify-snapshot-attribute --snapshot-id \"$SNAP\" --attribute createVolumePermission --operation-type add --user-ids 123456789012"]],
    // Removing public access.
    ["scripts/unshare.sh", ["aws ec2 modify-image-attribute --image-id \"$AMI\" --launch-permission \"Remove=[{Group=all}]\""]],
    ["scripts/unshare.sh", ["aws ec2 modify-snapshot-attribute --snapshot-id \"$SNAP\" --attribute createVolumePermission --operation-type remove --group-names all"]],
    ["pkg/aws/images.go", ["\tmod := &ec2.ModifyImageAttributeInput{", "\t\tLaunchPermission: &ec2.LaunchPermissionModifications{", "\t\t\tRemove: []*ec2.LaunchPermission{", "\t\t\t\t{", "\t\t\t\t\tGroup: aws.String(\"all\"),", "\t\t\t\t},"]],
    ["tools/unshare.py", ["rds.modify_db_snapshot_attribute(DBSnapshotIdentifier=name, AttributeName=\"restore\", ValuesToRemove=[\"all\"])"]],
    // Other uses of "all", and private galleries.
    ["inventory/hosts.py", ["self.inventory.add_host(hostname, group=\"all\")"]],
    ["infra/gallery.tf", ["resource \"azurerm_shared_image_gallery\" \"images\" {", "  sharing {", "    permission = \"Groups\"", "  }", "}"]],
    // Comments.
    ["scripts/publish.sh", ["# aws ec2 modify-image-attribute --image-id \"$AMI\" --launch-permission \"Add=[{Group=all}]\""]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicSnapshotSkipsTestsAndCanBeDisabled(): void {
  const lines = ["resource \"aws_db_snapshot\" \"orders\" {", "  shared_accounts = [\"all\"]", "}"];
  assert.deepEqual(findings([added("test/fixtures/backups.tf", lines)]), []);
  assert.deepEqual(findings([added("examples/public/backups.tf", lines)]), []);
  assert.deepEqual(findings([added("docs/backups.md", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { publicSnapshot: { enabled: false } } });
  assert.deepEqual(findings([added("infra/backups.tf", lines)], config), []);
}
