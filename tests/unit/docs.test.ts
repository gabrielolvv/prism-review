import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { headingAnchor, ruleDocsUrl, ruleSections } from "../../src/reporting/rule-docs.js";
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

// Each finding links to its rule's section, so every rule needs one that exists.
export function testEveryRuleLinksToItsDocumentation(): void {
  const docs = readFileSync("docs/configuration.md", "utf8");
  const anchors = new Set([...docs.matchAll(/^## (.+)$/gm)].map((match) => headingAnchor(match[1] ?? "")));

  assert.deepEqual(Object.keys(ruleSections).sort(), defaultRules.map((rule) => rule.id).sort());
  for (const rule of defaultRules) {
    const url = ruleDocsUrl(rule.id) ?? "";
    assert.match(url, /^https:\/\/github\.com\/gabrielolvv\/prism-review\/blob\/master\/docs\/configuration\.md#[a-z-]+$/);
    assert.ok(anchors.has(url.split("#")[1] ?? ""), `${rule.id}: ${url}`);
  }
  assert.equal(headingAnchor("Risky APIs"), "risky-apis");
  assert.equal(headingAnchor("Where the Configuration Comes From"), "where-the-configuration-comes-from");
  assert.equal(ruleDocsUrl("custom-rule"), undefined);
}

export function testConfigurationDocsListEveryRuleByArea(): void {
  const docs = readFileSync("docs/configuration.md", "utf8");
  const index = docs.slice(docs.indexOf("## Rules by Area"), docs.indexOf("## Where the Configuration Comes From"));
  const areaTable = docs.slice(docs.indexOf("| Area | Rules |"), docs.indexOf("When the comment reaches its size limit"));

  for (const rule of defaultRules) {
    assert.ok(index.includes(`[\`${rule.id}\`](#`), `the rule index is missing ${rule.id}`);
    assert.ok(areaTable.includes(`\`${rule.id}\``), `the area table is missing ${rule.id}`);
  }
}
