import assert from "node:assert/strict";
import type { Finding, ReviewResult } from "../../src/analysis/finding.js";
import { parseConfig } from "../../src/config/load-config.js";
import { renderAnnotations } from "../../src/reporting/render-annotations.js";

export function testRenderAnnotationsMapsSeverityToCommands(): void {
  const annotations = renderAnnotations(
    result([
      finding({ severity: "high", file: "src/auth/session.ts", title: "Sensitive file changed" }),
      finding({ severity: "warning", file: "package.json", title: "Dependency definition changed" })
    ])
  );

  assert.deepEqual(annotations, [
    "::error file=src/auth/session.ts,title=Prism Review%3A Sensitive file changed::Review this change.",
    "::warning file=package.json,title=Prism Review%3A Dependency definition changed::Review this change."
  ]);
}

export function testRenderAnnotationsSkipsFindingsWithoutFile(): void {
  const annotations = renderAnnotations(
    result([finding({ severity: "warning", title: "Source changed without tests" })])
  );

  assert.deepEqual(annotations, []);
}

export function testRenderAnnotationsHidesInfoByDefault(): void {
  const findings = [finding({ severity: "info", file: "dist/index.cjs", title: "Patch too large" })];

  assert.deepEqual(renderAnnotations(result(findings)), []);
  assert.deepEqual(renderAnnotations(result(findings), { includeLowSeverity: true }), [
    "::notice file=dist/index.cjs,title=Prism Review%3A Patch too large::Review this change."
  ]);
}

export function testRenderAnnotationsIncludesLineAndRecommendation(): void {
  const [annotation] = renderAnnotations(
    result([
      finding({
        file: "src/auth/session.ts",
        line: 12,
        recommendation: "Ask the owner, then merge."
      })
    ])
  );

  assert.equal(
    annotation,
    "::error file=src/auth/session.ts,line=12,title=Prism Review%3A Finding::" +
      "Review this change.%0A%0ARecommendation: Ask the owner, then merge."
  );
}

export function testRenderAnnotationsEscapesPullRequestContent(): void {
  // Git allows newlines, colons, commas, and percent signs in file names.
  const path = "docs/a,b:c%0A\n::stop-commands::resume\r\n::add-mask::x.md";
  const [annotation] = renderAnnotations(
    result([finding({ file: path, message: `${path} changed.` })])
  );

  assert.ok(annotation);
  assert.doesNotMatch(annotation, /[\r\n]/);

  const parsed = parseWorkflowCommand(annotation);
  assert.equal(parsed.command, "error");
  assert.deepEqual(Object.keys(parsed.properties), ["file", "title"]);
  assert.equal(parsed.properties.file, path);
  assert.equal(parsed.properties.title, "Prism Review: Finding");
  assert.equal(parsed.message, `${path} changed.`);
}

// Mirrors how the Actions runner reads a workflow command line.
function parseWorkflowCommand(line: string): {
  command: string;
  properties: Record<string, string>;
  message: string;
} {
  assert.ok(line.startsWith("::"), line);
  const headerEnd = line.indexOf("::", 2);
  assert.ok(headerEnd > 2, line);

  const header = line.slice(2, headerEnd);
  const spaceIndex = header.indexOf(" ");
  const command = spaceIndex === -1 ? header : header.slice(0, spaceIndex);
  const properties: Record<string, string> = {};

  if (spaceIndex !== -1) {
    for (const entry of header.slice(spaceIndex + 1).split(",")) {
      const equalsIndex = entry.indexOf("=");
      properties[entry.slice(0, equalsIndex)] = unescapeProperty(entry.slice(equalsIndex + 1));
    }
  }

  return { command, properties, message: unescapeData(line.slice(headerEnd + 2)) };
}

function unescapeData(value: string): string {
  return value.replace(/%0D/g, "\r").replace(/%0A/g, "\n").replace(/%25/g, "%");
}

function unescapeProperty(value: string): string {
  return unescapeData(value.replace(/%3A/g, ":").replace(/%2C/g, ","));
}

export function testConfigDisablesAnnotationsByDefault(): void {
  assert.deepEqual(parseConfig("", "test").annotations, {
    enabled: false,
    includeLowSeverity: false
  });
  assert.deepEqual(parseConfig("annotations:\n  enabled: true\n", "test").annotations, {
    enabled: true,
    includeLowSeverity: false
  });
}

function result(findings: Finding[]): ReviewResult {
  return { summary: "Reviewed changed files.", riskLevel: "high", findings };
}

function finding(overrides: Partial<Finding>): Finding {
  return {
    ruleId: "test-rule",
    title: "Finding",
    severity: "high",
    message: "Review this change.",
    ...overrides
  };
}
