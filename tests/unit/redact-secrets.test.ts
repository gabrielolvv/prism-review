import assert from "node:assert/strict";
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
