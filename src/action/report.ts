import { appendFileSync } from "node:fs";
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
