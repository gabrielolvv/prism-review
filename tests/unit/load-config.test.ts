import assert from "node:assert/strict";
import { parseConfig } from "../../src/config/load-config.js";
import { defaultConfig } from "../../src/config/schema.js";

export function testParseConfigAppliesDefaults(): void {
  const config = parseConfig("risk:\n  largeDiff:\n    maxFiles: 5\n", "custom.yml");

  assert.equal(config.risk.largeDiff.maxFiles, 5);
  assert.equal(config.risk.largeDiff.maxChangedLines, 800);
  assert.deepEqual(config.rules, defaultConfig.rules);
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
