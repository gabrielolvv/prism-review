import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { countBySeverity, type ReviewResult } from "../analysis/finding.js";

// Step outputs hold only values the action computes, never pull request content.
export function writeOutputs(result: ReviewResult, outputPath = process.env.GITHUB_OUTPUT): void {
  if (!outputPath) {
    return;
  }

  const outputs = {
    "risk-level": result.riskLevel,
    "high-count": countBySeverity(result.findings, "high"),
    "warning-count": countBySeverity(result.findings, "warning"),
    "finding-count": result.findings.length
  };

  appendFileSync(
    outputPath,
    Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join("")
  );
}

// The job summary shows the review on the run page, including when no comment can be posted.
export function writeJobSummary(body: string, summaryPath = process.env.GITHUB_STEP_SUMMARY): void {
  if (summaryPath) {
    appendFileSync(summaryPath, `${body}\n`);
  }
}

// The action needs no checkout, so the workspace may be empty; the report's directory is created.
export function writeSarif(
  relativePath: string,
  sarif: string,
  workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${sarif}\n`);
  console.log(`Wrote the SARIF report to ${relativePath}.`);
}
