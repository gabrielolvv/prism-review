import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultRules } from "../../src/rules/index.js";

// Every registered rule must be listed for users, so new rules cannot ship undocumented.
export function testReadmeListsEveryRule(): void {
  const readme = readFileSync("README.md", "utf8");
  const table = readme.slice(readme.indexOf("## Current Rules"), readme.indexOf("## Example Output"));

  for (const rule of defaultRules) {
    assert.match(table, new RegExp(`^\\| \`${rule.id}\` \\|`, "m"), `README is missing ${rule.id}`);
  }
}

export function testConfigurationDocsNameEveryRule(): void {
  const docs = readFileSync("docs/configuration.md", "utf8");

  for (const rule of defaultRules) {
    assert.ok(docs.includes(`\`${rule.id}\``), `docs/configuration.md is missing ${rule.id}`);
  }
}
