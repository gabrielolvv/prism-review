// Runs every content rule over a directory of real code, as if a pull request added each file, and
// prints how many files each rule reports, to find false positives before a release:
//
//   npm run build && node scripts/scan-corpus.mjs <directory> [report.json]
//
// The report lists up to 400 findings per rule with the lines they point to. Rules about the shape
// of a pull request, such as large-diff, are left out, since every file here is a new one.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { analyzePullRequest } from "../build/src/analysis/analyze-pull-request.js";
import { defaultConfig } from "../build/src/config/schema.js";
import { prepareChangedFiles } from "../build/src/security/prepare-changed-files.js";

const [corpus, reportPath] = process.argv.slice(2);
if (!corpus) {
  console.error("Usage: node scripts/scan-corpus.mjs <directory> [report.json]");
  process.exit(1);
}

const shapeRules = new Set(["large-diff", "missing-tests", "dependency-risk", "sensitive-files", "oversized-patch", "incomplete-review", "config-change", "review-control-change"]);
const binary = /\.(?:png|jpe?g|gif|ico|woff2?|ttf|eot|pdf|zip|gz|tgz|mo|pyc|so|dll|bin|svg|map)$/i;

const paths = [];
(function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else if (!binary.test(name) && stat.size < 400_000) {
      paths.push(path);
    }
  }
})(corpus);

const byRule = {};
for (const path of paths) {
  const text = readFileSync(path, "utf8");
  if (text.includes("\u0000")) {
    continue;
  }
  const lines = text.split("\n");
  const file = {
    path: relative(corpus, path),
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n")
  };
  for (const finding of analyzePullRequest(prepareChangedFiles([file], defaultConfig), defaultConfig).findings) {
    if (shapeRules.has(finding.ruleId)) {
      continue;
    }
    const entry = (byRule[finding.ruleId] ??= { files: 0, findings: [] });
    entry.files += 1;
    if (entry.findings.length < 400) {
      const shown = (finding.lines ?? (finding.line === undefined ? [] : [finding.line])).slice(0, 3);
      entry.findings.push({ file: file.path, lines: shown.map((line) => `${line}: ${lines[line - 1]?.trim().slice(0, 200)}`) });
    }
  }
}

console.log(`${paths.length} files`);
for (const [ruleId, { files }] of Object.entries(byRule).sort((left, right) => right[1].files - left[1].files)) {
  console.log(`${String(files).padStart(6)}  ${ruleId}`);
}
if (reportPath) {
  writeFileSync(reportPath, `${JSON.stringify(byRule, null, 2)}\n`);
}
