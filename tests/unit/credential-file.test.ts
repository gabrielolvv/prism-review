import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile, FileStatus } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

export function testCredentialFileRuleReportsFilesThatHoldCredentials(): void {
  const paths = [
    "keys/id_ed25519",
    "certs/server.key",
    "letsencrypt/live/example.com/privkey.pem",
    "pki/server-key.pem",
    "android/app/release.keystore",
    "certs/client.p12",
    "infra/terraform.tfstate",
    "infra/terraform.tfstate.backup",
    "config/.git-credentials",
    ".netrc",
    "home/.aws/credentials",
    "home/.docker/config.json",
    "ops/.kube/config",
    "ops/staging.kubeconfig",
    "gcp/service-account-prod.json",
    "web/client_secret_1234.apps.googleusercontent.com.json"
  ];

  const findings = credentialFindings(paths.map((path) => file(path, ["data"])));

  assert.deepEqual(
    findings.map((finding) => finding.file),
    paths
  );
  assert.ok(findings.every((finding) => finding.severity === "high" && finding.line === undefined));
  assert.equal(
    findings[0]?.message,
    "This is a private key, a kind of file that usually holds credentials, so they would be readable by anyone with access to the repository."
  );
  assert.match(findings[1]?.message ?? "", /^This is a key file,/);
  assert.match(findings[6]?.message ?? "", /^This is a Terraform state file,/);
}

export function testCredentialFileRuleReportsSecretsInEnvironmentFiles(): void {
  const findings = credentialFindings([
    file(".env", [
      "# Local settings",
      "NODE_ENV=production",
      "VITE_API_URL=https://api.example.com",
      "DATABASE_URL=postgres://app:hunter2@db.internal/app",
      "export STRIPE_SECRET_KEY=\"sk_live_abc\"",
      "SMTP_PASSWORD=correct-horse  # rotated monthly"
    ]),
    file("services/api/.env.production", ["JWT_SECRET: abc123"]),
    file("deploy/prod.env", ["REDIS_URL=redis://default:s3cret@cache:6379"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]),
    [
      [".env", 4, "high"],
      ["services/api/.env.production", 1, "high"],
      ["deploy/prod.env", 1, "high"]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Lines 4, 5, 6 add secrets to an environment file, so they would be readable by anyone with access to the repository."
  );
  assert.equal(
    findings[1]?.message,
    "Line 1 adds a secret to an environment file, so it would be readable by anyone with access to the repository."
  );
}

export function testCredentialFileRuleReportsPackageManagerTokens(): void {
  const findings = credentialFindings([
    file(".npmrc", ["registry=https://registry.npmjs.org/", "//registry.npmjs.org/:_authToken=npm_abc123"]),
    file("app/.yarnrc.yml", ["npmRegistryServer: https://npm.example.com", "npmAuthToken: abc123"]),
    file(".pypirc", ["[pypi]", "username = __token__", "password = pypi-abc123"]),
    // Reading the token from the environment is the safe way to configure these files.
    file("lib/.npmrc", ["//registry.npmjs.org/:_authToken=${NPM_TOKEN}"]),
    file("lib/.yarnrc.yml", ["npmAuthToken: \"${NPM_TOKEN}\""]),
    file("tools/.npmrc", ["save-exact=true"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line]),
    [
      [".npmrc", 2],
      ["app/.yarnrc.yml", 2],
      [".pypirc", 3]
    ]
  );
  assert.equal(
    findings[0]?.message,
    "Line 2 adds a registry token to a package manager configuration file, so it would be readable by anyone with access to the repository."
  );
}

export function testCredentialFileRuleIgnoresExamplesTestsAndPublicFiles(): void {
  const findings = credentialFindings([
    file(".env.example", ["API_KEY=abc123"]),
    file(".env.sample", ["API_KEY=abc123"]),
    file("docker/.env.template", ["API_KEY=abc123"]),
    file(".env.dist", ["API_KEY=abc123"]),
    file("config/example.env", ["API_KEY=abc123"]),
    // Public values, empty values, placeholders, and references to other variables.
    file("web/.env", [
      "NEXT_PUBLIC_STRIPE_KEY=pk_live_abc",
      "VITE_FIREBASE_API_KEY=AIzaSyabc",
      "API_KEY=",
      "SECRET_KEY=changeme",
      "DB_PASSWORD=<your password>",
      "TOKEN=${GITHUB_TOKEN}",
      "AUTH_URL=https://auth.example.com/login",
      "DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev",
      "CACHE_URL=redis://cache:6379",
      "MAX_TOKENS=4096",
      "TOKEN_TTL_SECONDS=3600",
      "PASSWORD_MIN_LENGTH=12",
      "POSTGRES_PASSWORD=postgres",
      "COMPOSE_DB_URL=postgres://app:postgres@db:5432/app",
      "# PASSWORD=hunter2"
    ]),
    file("keys/id_ed25519.pub", ["ssh-ed25519 AAAA"]),
    file("certs/ca.pem", ["-----BEGIN CERTIFICATE-----"]),
    file("certs/public-key.pem", ["-----BEGIN PUBLIC KEY-----"]),
    // Keynote presentations share the extension; GitHub sends no patch for them.
    { path: "docs/talk.key", status: "added", additions: 0, deletions: 0 },
    file("src/env.ts", ["export const env = {};"]),
    file("docs/terraform.tfstate.md", ["How state works"]),
    file(".env/lib/python3.12/site.py", ["import os"]),
    file("tests/fixtures/.env", ["API_KEY=abc123"]),
    file("pkg/tls/testdata/server.key", ["fake"]),
    file("spec/fixtures/files/release.keystore", ["fake"]),
    file("src/__tests__/.env.test", ["API_KEY=abc123"])
  ]);

  assert.deepEqual(findings, []);
}

export function testCredentialFileRuleSkipsDeletionsAndSeesIgnoredPaths(): void {
  const config = prismConfigSchema.parse({ ignorePaths: ["infra/**", "**/.env", "keys/**"] });
  const files = [
    file("keys/id_rsa", ["data"], "removed"),
    file("infra/terraform.tfstate", ["{}"]),
    { ...file("config/.env", ["API_TOKEN=abc123"], "renamed"), previousPath: "config/settings" }
  ];

  assert.deepEqual(
    analyzePullRequest(files, config)
      .findings.filter((finding) => finding.ruleId === "credential-file")
      .map((finding) => finding.file),
    ["infra/terraform.tfstate", "config/.env"]
  );
}

export function testCredentialFileRuleReadsValuesBeforeRedaction(): void {
  // Redaction rewrites `TOKEN=${GITHUB_TOKEN}` and `password = ...`, so the rule must see the
  // original lines: one is a safe reference, the other a real value.
  const files = prepareChangedFiles(
    [
      file("web/.env", ["TOKEN=${GITHUB_TOKEN}", "API_KEY=${API_KEY}"]),
      file(".pypirc", ["[pypi]", "password = pypi-abc123"])
    ],
    defaultConfig
  );

  assert.match(files[1]?.patch ?? "", /\[REDACTED\]/);
  assert.deepEqual(
    credentialFindings(files).map((finding) => [finding.file, finding.line]),
    [[".pypirc", 2]]
  );
}

export function testCredentialFileRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { credentialFiles: { enabled: false } } });

  assert.ok(
    !analyzePullRequest([file("keys/id_rsa", ["data"])], config).findings.some((finding) => finding.ruleId === "credential-file")
  );
}

function credentialFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "credential-file");
}

function file(path: string, lines: string[], status: FileStatus = "added"): ChangedFile {
  const sign = status === "removed" ? "-" : "+";
  const header = status === "removed" ? `@@ -1,${lines.length} +0,0 @@` : `@@ -0,0 +1,${lines.length} @@`;
  const patch = [header, ...lines.map((line) => `${sign}${line}`)].join("\n");
  return {
    path,
    status,
    additions: status === "removed" ? 0 : lines.length,
    deletions: status === "removed" ? lines.length : 0,
    patch
  };
}
