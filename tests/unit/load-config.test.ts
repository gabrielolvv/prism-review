import assert from "node:assert/strict";
import { parseConfig } from "../../src/config/load-config.js";
import { defaultConfig } from "../../src/config/schema.js";

export function testParseConfigAppliesDefaults(): void {
  const config = parseConfig("risk:\n  largeDiff:\n    maxFiles: 5\n", "custom.yml");

  assert.equal(config.risk.largeDiff.maxFiles, 5);
  assert.equal(config.risk.largeDiff.maxChangedLines, 800);
  assert.deepEqual(config.rules, defaultConfig.rules);
}

// A section that is left out, or given as an empty map, still gets the defaults of every field in
// it. Checked against literal values, since a schema that skipped them would change defaultConfig too.
export function testParseConfigFillsNestedDefaults(): void {
  for (const raw of ["", "rules: {}\ncomment: {}\nai: {}\n", "rules:\n  missingTests:\n    enabled: false\n"]) {
    const config = parseConfig(raw, "nested.yml");

    assert.equal(config.risk.largeDiff.maxChangedLines, 800);
    assert.equal(config.rules.missingTests.sourceGlobs[0], "src/**/*.{ts,tsx,js,jsx}");
    assert.equal(config.rules.sensitiveFiles.enabled, true);
    assert.deepEqual(config.rules.unpinnedActions.allowedOwners, ["actions", "github"]);
    assert.equal(config.security.maxPatchBytes, 200_000);
    assert.deepEqual(config.security.redaction.allowlist, []);
    assert.equal(config.comment.mode, "upsert");
    assert.equal(config.comment.dependencyChanges, true);
    assert.equal(config.reviewComments.maxComments, 25);
    assert.equal(config.check.failOn, "never");
    assert.deepEqual(config.severity, {});
    assert.equal(config.ai.enabled, false);
    assert.equal(config.ai.maxInputCharacters, 100_000);
  }
}

export function testParseConfigTreatsEmptyFileAsDefaults(): void {
  assert.deepEqual(parseConfig("", "empty.yml"), defaultConfig);
}

export function testParseConfigReportsSourceAndField(): void {
  assert.throws(
    () => parseConfig("risk:\n  largeDiff:\n    maxFiles: -1\n", ".prism-review.yml"),
    /^Error: Invalid Prism Review configuration in \.prism-review\.yml: risk\.largeDiff\.maxFiles: /
  );
}

export function testParseConfigLabelsRootErrors(): void {
  assert.throws(
    () => parseConfig("- risk\n", "list.yml"),
    /^Error: Invalid Prism Review configuration in list\.yml: \(root\): /
  );
}

export function testParseConfigReportsYamlErrors(): void {
  assert.throws(
    () => parseConfig("risk: [unclosed\n", "broken.yml"),
    /^Error: Invalid Prism Review configuration in broken\.yml: /
  );
}
