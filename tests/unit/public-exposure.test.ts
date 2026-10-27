import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testPublicExposureRuleReportsOpenPortsAndPublicStorage(): void {
  const findings = exposureFindings([
    file("infra/network.tf", [
      'resource "aws_security_group" "bastion" {',
      "  ingress {",
      "    from_port   = 443",
      "    to_port     = 443",
      '    cidr_blocks = ["0.0.0.0/0"]',
      "  }",
      "  ingress {",
      "    from_port        = 22",
      "    to_port          = 22",
      '    cidr_blocks      = ["0.0.0.0/0"]',
      '    ipv6_cidr_blocks = ["::/0"]',
      "  }",
      "}",
      'resource "google_compute_firewall" "db" {',
      '  source_ranges = ["0.0.0.0/0"]',
      "  allow {",
      '    protocol = "tcp"',
      '    ports    = ["80", "5000-5500"]',
      "  }",
      "}"
    ]),
    file("infra/storage.tf", [
      'resource "aws_s3_bucket_acl" "assets" {',
      '  acl = "public-read"',
      "}",
      'resource "aws_s3_bucket_public_access_block" "assets" {',
      "  block_public_acls       = false",
      "  restrict_public_buckets = false",
      "}",
      'resource "aws_db_instance" "main" {',
      "  publicly_accessible = true",
      "}",
      'resource "google_storage_bucket_iam_member" "public" {',
      '  member = "allUsers"',
      "}"
    ]),
    file("cloudformation/sg.yaml", [
      "Resources:",
      "  AdminSecurityGroup:",
      "    Type: AWS::EC2::SecurityGroup",
      "    Properties:",
      "      SecurityGroupIngress:",
      "        - IpProtocol: tcp",
      "          FromPort: 3389",
      "          ToPort: 3389",
      "          CidrIp: 0.0.0.0/0",
      "        - IpProtocol: -1",
      "          CidrIpv6: ::/0"
    ]),
    file("cloudformation/cache.json", ['{ "IpProtocol": "tcp", "FromPort": 6379, "ToPort": 6379, "CidrIp": "0.0.0.0/0" }']),
    file("azure/nsg.tf", [
      "  security_rule {",
      '    name                       = "ssh"',
      '    destination_port_range     = "*"',
      '    source_address_prefix      = "Internet"',
      "  }"
    ])
  ]);

  const message = (path: string) => findings.find((finding) => finding.file === path)?.message;
  assert.ok(findings.every((finding) => finding.severity === "high"));
  assert.equal(
    message("infra/network.tf"),
    "Lines 10, 11, 15 expose resources to the internet: opens ports 22, 5432 to the internet."
  );
  assert.equal(
    message("infra/storage.tf"),
    "Lines 2, 5, 6, 9, 12 expose resources to the internet: makes a storage bucket public, makes a database publicly accessible, and grants access to allUsers."
  );
  assert.equal(
    message("cloudformation/sg.yaml"),
    "Lines 9, 11 expose resources to the internet: opens port 3389 to the internet, and opens every port to the internet."
  );
  assert.equal(message("cloudformation/cache.json"), "Line 1 exposes resources to the internet: opens port 6379 to the internet.");
  assert.equal(message("azure/nsg.tf"), "Line 4 exposes resources to the internet: opens every port to the internet.");
}

export function testPublicExposureRuleAllowsPublicWebAndPrivateRanges(): void {
  const findings = exposureFindings([
    file("infra/web.tf", [
      'resource "aws_security_group" "web" {',
      "  ingress {",
      "    from_port   = 80",
      "    to_port     = 443",
      '    cidr_blocks = ["0.0.0.0/0"]',
      "  }",
      "  ingress {",
      "    from_port   = 22",
      "    to_port     = 22",
      '    cidr_blocks = ["10.0.0.0/8"]',
      "  }",
      "  egress {",
      "    from_port   = 0",
      "    to_port     = 0",
      '    protocol    = "-1"',
      '    cidr_blocks = ["0.0.0.0/0"]',
      "  }",
      "}",
      'resource "aws_s3_bucket_public_access_block" "logs" {',
      "  block_public_acls = true",
      "}",
      '  acl = "private"',
      "  publicly_accessible = false",
      '  # cidr_blocks = ["0.0.0.0/0"] with from_port = 22'
    ]),
    file("infra/nacl.tf", [
      'resource "aws_network_acl_rule" "out" {',
      "  egress      = true",
      '  cidr_block  = "0.0.0.0/0"',
      "  from_port   = 22",
      "  to_port     = 22",
      "}",
      'resource "aws_network_acl_rule" "block_rdp" {',
      '  rule_action = "deny"',
      '  cidr_block  = "0.0.0.0/0"',
      "  from_port   = 3389",
      "  to_port     = 3389",
      "}"
    ]),
    file("k8s/netpol.yaml", ["  egress:", "    - to:", "        - ipBlock:", "            cidr: 0.0.0.0/0", "      ports:", "        - port: 443"]),
    file("docs/network.md", ['Never set `cidr_blocks = ["0.0.0.0/0"]` with `from_port = 22`.']),
    file("tests/fixtures/sg.tf", ['    cidr_blocks = ["0.0.0.0/0"]', "    from_port = 22"])
  ]);

  assert.deepEqual(findings, []);
}

export function testPublicExposureRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { publicExposure: { enabled: false } } });
  const files = [file("infra/s3.tf", ['  acl = "public-read"'])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "public-exposure"));
}

function exposureFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "public-exposure");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
