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

// The optional context follows the hunk header, which tells the parser the section a hunk starts in.
const cases: Array<[path: string, prefix: string, repeated: string, context?: string]> = [
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
  ["package.json", '"@a/', "a"],
  ["Gemfile", "gem ", "a"],
  ["go.mod", "require ", "a"],
  ["App.csproj", "<PackageReference ", "Include=\"a\" "],
  ["composer.json", '"', "a/"],
  [".github/workflows/a.yml", "permissions: {", "a: write, "],
  ["k8s/role.yaml", "verbs: [", "a, ", "kind: ClusterRole"],
  ["scripts/a.sh", ["ch", "mod "].join(""), "-R "],
  ["src/a.py", ["os.ch", "mod("].join(""), "a"],
  ["scripts/b.sh", "", "umask 0"],
  ["src/server.ts", "res.cookie(", "a, "],
  ["src/cors.ts", "app.use(cors({ ", "origin: a, "],
  ["app.py", "app.run(", "a, "],
  ["infra/main.tf", "", 'Action = ["'],
  ["infra/main.tf", "min_tls_version = \"", "TLS"],
  ["policy.json", "", '"Action": ['],
  ["Dockerfile", "ENV ", "a "],
  ["Dockerfile", 'ENV A="', "x "],
  ["Dockerfile", "FROM ", "--a=b "],
  ["Dockerfile", "ADD ", "https://a "],
  ["pom.xml", "<dependency>", "<groupId> "],
  ["build.gradle", "implementation '", "a"],
  ["build.gradle.kts", "implementation(group = \"", "a"],
  ["gradle/libs.versions.toml", "a = ", "{ module = \"a", "[libraries]"]
];

export function testRulePatternsStayLinearOnLongLines(): void {
  const slow: string[] = [];

  for (const [path, prefix, repeated, context = ""] of cases) {
    const line = (prefix + repeated.repeat(Math.ceil(length / repeated.length))).slice(0, length) + "x";
    const file: ChangedFile = { path, status: "added", additions: 1, deletions: 0, patch: `@@ -0,0 +1 @@${context && ` ${context}`}\n+${line}` };
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
