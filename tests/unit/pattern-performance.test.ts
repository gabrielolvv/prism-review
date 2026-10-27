import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig } from "../../src/config/schema.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

// Rules run regular expressions over lines a pull request author writes. A pattern that backtracks
// over the whole line from every repeated prefix takes time quadratic in its length, so one crafted
// line could stall the review and the gate. Each case below once took seconds at this length; at
// linear cost it takes a fraction of one.
const length = 200_000;
const budgetMs = 3_000;

const cases: Array<[path: string, prefix: string, repeated: string]> = [
  ["pyproject.toml", "", "{"],
  ["pyproject.toml", "", "github.event['"],
  ["Dockerfile", "", "curl "],
  ["scripts/setup.ps1", "", "DownloadString("],
  ["scripts/setup.ps1", "", "iex(New-Object "],
  ["src/Client.cs", "", "ServerCertificateValidationCallback = "],
  ["scripts/fetch.sh", "", "wget a "],
  ["k8s/pod.yaml", "", "cap_add: ["],
  ["db/migrations/001_users.sql", "", "alter table "],
  ["app/db.py", 'cursor.execute(f"', "select "],
  [".github/workflows/ci.yml", "      - run: ", "${{ "],
  ["src/lib.rs", "", "#[allow("],
  ["app/config.py", "", "yaml.load("],
  ["pkg/run.go", "", "exec.Command("],
  ["Tests/AppTests.swift", "", "@Test("],
  ["tests/FooTest.php", "", "it("],
  ["infra/fw.tf", "", "ports = ["],
  ["app/db.py", "# prism-review-ignore sql-injection -- ", " "],
  ["pyproject.toml", "", '"a'],
  ["requirements.txt", "", "a"],
  ["package.json", '"', "a"],
  ["Gemfile", "gem ", "a"],
  ["go.mod", "require ", "a"]
];

export function testRulePatternsStayLinearOnLongLines(): void {
  const slow: string[] = [];

  for (const [path, prefix, repeated] of cases) {
    const line = (prefix + repeated.repeat(Math.ceil(length / repeated.length))).slice(0, length) + "x";
    const file: ChangedFile = { path, status: "added", additions: 1, deletions: 0, patch: `@@ -0,0 +1 @@\n+${line}` };
    // A large patch limit, so the long line reaches every rule instead of being dropped.
    const config = { ...defaultConfig, security: { ...defaultConfig.security, maxPatchBytes: 1_000_000 } };

    const started = performance.now();
    analyzePullRequest(prepareChangedFiles([file], config), config);
    const elapsed = performance.now() - started;
    if (elapsed > budgetMs) {
      slow.push(`${path} with ${JSON.stringify(repeated)}: ${Math.round(elapsed)} ms`);
    }
  }

  assert.deepEqual(slow, []);
}
