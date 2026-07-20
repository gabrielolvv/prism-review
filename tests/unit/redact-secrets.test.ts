import assert from "node:assert/strict";
import { prismConfigSchema } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";
import { redactChangedFiles, redactSecrets } from "../../src/security/redact-secrets.js";
import { loadDiffFixture } from "../../src/testing/fixture-loader.js";

export function testRedactSecrets(): void {
  const input = 'OPENAI_API_KEY: "sk-thisShouldNeverAppearInReviewOutput1234567890"';

  const output = redactSecrets(input);

  assert.match(output, /\[REDACTED\]/);
  assert.doesNotMatch(output, /sk-thisShouldNeverAppear/);
}

export function testRedactChangedFilesDoesNotMutateOriginal(): void {
  const files = loadDiffFixture("fixtures/diffs/secret-leak.diff");

  const redacted = redactChangedFiles(files);

  assert.notEqual(redacted[0], files[0]);
  assert.match(redacted[0]?.patch ?? "", /\[REDACTED\]/);
  assert.match(files[0]?.patch ?? "", /sk-thisShouldNeverAppear/);
}

const gitSha = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const gitShaPattern = /^[0-9a-f]{40}$/;

export function testRedactSecretsKeepsAllowlistedValues(): void {
  const input = `resolved commit ${gitSha}`;

  assert.equal(redactSecrets(input), "resolved commit [REDACTED]");
  assert.equal(redactSecrets(input, { allowlist: [gitShaPattern] }), input);
}

export function testRedactSecretsKeepsAllowlistedAssignments(): void {
  const input = 'password: "changeme-placeholder"';

  assert.equal(redactSecrets(input, { allowlist: [/^changeme-/] }), input);
}

export function testAllowlistDoesNotShieldOtherSecrets(): void {
  const token = `ghp_${"a".repeat(36)}`;
  const input = `commit ${gitSha}\nGITHUB_TOKEN=${token}`;

  const output = redactSecrets(input, { allowlist: [gitShaPattern] });

  assert.match(output, new RegExp(gitSha));
  assert.doesNotMatch(output, new RegExp(token));
  assert.match(output, /GITHUB_TOKEN= \[REDACTED\]/);
}

export function testConfigRejectsInvalidAllowlistPattern(): void {
  const valid = prismConfigSchema.safeParse({
    security: { redaction: { allowlist: ["^[0-9a-f]{40}$"] } }
  });
  const invalid = prismConfigSchema.safeParse({
    security: { redaction: { allowlist: ["("] } }
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
}

export function testPrepareChangedFilesAppliesAllowlist(): void {
  const config = prismConfigSchema.parse({
    security: { redaction: { allowlist: ["^[0-9a-f]{40}$"] } }
  });
  const files = [
    {
      path: "docs/release.md",
      status: "modified" as const,
      additions: 1,
      deletions: 0,
      patch: `+Released from ${gitSha}`
    }
  ];

  const prepared = prepareChangedFiles(files, config);

  assert.equal(prepared[0]?.patch, `+Released from ${gitSha}`);
}
