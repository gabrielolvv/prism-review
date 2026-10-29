import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  fakeAiBaseSha,
  fakeAiFailureBaseSha,
  fakeAnnotationsBaseSha,
  fakeAppendBaseSha,
  fakeBaseSha,
  fakeComparisonBaseSha,
  fakeFailOnHighBaseSha,
  fakeLeakedToken,
  fakeLockfileBaseSha,
  fakeHeadSha,
  fakeReviewCommentsBaseSha
} from "../support/fake-github-api.js";

// Runs the committed bundle the way the runner does, against a fake GitHub API.
const actionEntry = resolve("dist/action/index.cjs");
const fakeApi = pathToFileURL(resolve("build/tests/support/fake-github-api.js")).href;
const workDir = mkdtempSync(join(tmpdir(), "prism-review-smoke-"));

type FakeRequest = {
  method: string;
  url: string;
  path: string;
  authorization?: string;
  body?: { body?: string };
};

type ActionRun = {
  status: number | null;
  stdout: string;
  stderr: string;
  requests: FakeRequest[];
};

function runAction(inputs: Record<string, string>, event: unknown): ActionRun {
  const eventPath = join(workDir, "event.json");
  writeFileSync(eventPath, JSON.stringify(event));

  const result = spawnSync(process.execPath, ["--import", fakeApi, actionEntry], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "acme/widgets",
      "INPUT_GITHUB-TOKEN": "test-token",
      ...inputs
    }
  });

  const requests = result.stderr
    .split(/\r?\n/)
    .filter((line) => line.startsWith("[fake-github] "))
    .map((line) => JSON.parse(line.slice("[fake-github] ".length)) as FakeRequest);

  return { status: result.status, stdout: result.stdout, stderr: result.stderr, requests };
}

const pullRequestEvent = { pull_request: { number: 7, base: { sha: fakeBaseSha } } };

const cliEntry = resolve("dist/cli/main.cjs");
const riskyDiff = readFileSync("fixtures/diffs/risky-auth-change.diff", "utf8");

type CliRun = { status: number | null; stdout: string; stderr: string };

function runCli(args: string[], stdin?: string): CliRun {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: workDir,
    encoding: "utf8",
    input: stdin,
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
  });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function writeConfig(name: string, contents: string): string {
  const path = join(workDir, name);
  writeFileSync(path, contents);
  return path;
}

const scenarios: Array<[string, () => void]> = [
  [
    "dry run reviews with the base branch configuration",
    () => {
      const run = runAction({ "INPUT_DRY-RUN": "true" }, pullRequestEvent);

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /<!-- prism-review-comment -->/);
      // Each of these depends on a value that only the base configuration sets.
      assert.match(run.stdout, /Large pull request/);
      assert.match(run.stdout, /#### Info - Patch too large to inspect\n\n[^\n]+\n\nFile: `src\/billing\/charge\.ts`/);
      assert.match(run.stdout, /#### High - Review configuration changed\n\n[^\n]+\n\nFile: `\.prism-review\.yml`/);
      assert.doesNotMatch(run.stdout, /File: `config\/prism\.yml`/);
      assert.match(
        run.stdout,
        /^::error file=\.prism-review\.yml,title=Prism Review%3A Review configuration changed::\S/m
      );
      // annotations.includeLowSeverity is not set, so the info finding stays in the comment only.
      assert.doesNotMatch(run.stdout, /^::notice /m);
      assert.ok(run.requests.every((request) => request.method === "GET"));
      assert.ok(run.requests.every((request) => request.authorization === "Bearer test-token"));
      assert.ok(run.requests.every((request) => request.url.startsWith("https://api.github.com/")));
    }
  ],
  [
    "requests go to the API URL the runner sets",
    () => {
      const run = runAction(
        { GITHUB_API_URL: "https://ghe.example.com/api/v3" },
        pullRequestEvent
      );

      assert.equal(run.status, 0, run.stderr);
      assert.ok(run.requests.length > 0);
      assert.ok(
        run.requests.every((request) => request.url.startsWith("https://ghe.example.com/api/v3/repos/")),
        JSON.stringify(run.requests.map((request) => request.url))
      );
      assert.ok(run.requests.some((request) => request.method === "PATCH"));
    }
  ],
  [
    "upsert updates the bot comment and ignores marked human comments",
    () => {
      const run = runAction({}, pullRequestEvent);
      const writes = run.requests.filter((request) => request.method !== "GET");

      assert.equal(run.status, 0, run.stderr);
      assert.equal(writes.length, 1);
      assert.equal(writes[0]?.method, "PATCH");
      assert.equal(writes[0]?.path, "/repos/acme/widgets/issues/comments/5");
      assert.match(writes[0]?.body?.body ?? "", /^<!-- prism-review-comment -->/);
    }
  ],
  [
    "append mode from the base branch posts a new comment",
    () => {
      const run = runAction({}, { pull_request: { number: 7, base: { sha: fakeAppendBaseSha } } });
      const writes = run.requests.filter((request) => request.method !== "GET");

      assert.equal(run.status, 0, run.stderr);
      assert.equal(writes.length, 1);
      assert.equal(writes[0]?.method, "POST");
      assert.equal(writes[0]?.path, "/repos/acme/widgets/issues/7/comments");
      // A CODEOWNERS path that is not a file only costs the owners.
      assert.match(run.stdout, /::warning title=Prism Review::Could not read CODEOWNERS, so owners are not shown: \.github\/CODEOWNERS is not a file/);
      assert.doesNotMatch(String(writes[0]?.body?.body), /Owners:/);
    }
  ],
  [
    "a custom config path is fetched, and a missing file falls back to defaults",
    () => {
      const run = runAction(
        { "INPUT_DRY-RUN": "true", "INPUT_CONFIG-PATH": "./config/prism.yml" },
        pullRequestEvent
      );

      assert.equal(run.status, 0, run.stderr);
      assert.ok(
        run.requests.some(
          (request) => request.path === `/repos/acme/widgets/contents/config/prism.yml?ref=${fakeBaseSha}`
        )
      );
      assert.match(run.stdout, /No config\/prism\.yml on the base branch; using the default configuration\./);
      assert.doesNotMatch(run.stdout, /Large pull request/);
      assert.doesNotMatch(run.stdout, /Patch too large to inspect/);
      assert.match(run.stdout, /#### High - Review configuration changed\n\n[^\n]+\n\nFile: `config\/prism\.yml`/);
      assert.doesNotMatch(run.stdout, /File: `\.prism-review\.yml`/);
      assert.doesNotMatch(run.stdout, /^::(error|warning|notice) /m);
    }
  ],
  [
    "a config path outside the repository fails the run",
    () => {
      const run = runAction({ "INPUT_CONFIG-PATH": "../shared/prism.yml" }, pullRequestEvent);

      assert.equal(run.status, 1);
      assert.match(run.stderr, /config-path must be a relative path inside the repository/);
      assert.equal(run.requests.length, 0);
    }
  ],
  [
    "dry run output cannot issue workflow commands from pull request content",
    () => {
      const run = runAction(
        { "INPUT_DRY-RUN": "true" },
        { pull_request: { number: 9, base: { sha: fakeBaseSha } } }
      );
      const lines = run.stdout.split(/\r?\n/);
      const stop = lines.findIndex((line) => /^::stop-commands::[0-9a-f-]{36}$/.test(line));
      const resume = lines.findIndex((line) => line === `::${lines[stop]?.slice("::stop-commands::".length)}::`);
      const body = lines.indexOf("<!-- prism-review-comment -->");

      assert.equal(run.status, 0, run.stderr);
      // The review keeps the path on one line, and the printed review is also fenced off.
      assert.ok(!lines.some((line) => line.startsWith("::error file=README.md::")), run.stdout);
      assert.match(run.stdout, /^File: `src\/auth\/x\\n::error file=README\.md::forged by the pull request\\n\.ts`$/m);
      assert.ok(stop !== -1 && stop < body && body < resume, run.stdout);
      // The annotation for the same path is escaped, so it stays one command.
      assert.match(run.stdout, /^::error file=src\/auth\/x%0A%3A%3Aerror file=README\.md%3A%3Aforged/m);
    }
  ],
  [
    "a leaked token is annotated on its line and never printed",
    () => {
      const run = runAction({}, { pull_request: { number: 11, base: { sha: fakeAnnotationsBaseSha } } });
      const comment = run.requests.find((request) => request.method === "POST")?.body?.body ?? "";

      assert.equal(run.status, 0, run.stderr);
      assert.match(
        run.stdout,
        /^::error file=scripts\/publish\.sh,line=6,title=Prism Review%3A Possible secret added::Line 6 adds what looks like a GitHub token\./m
      );
      assert.match(comment, /Risk level: \*\*High\*\*/);
      assert.match(comment, /^File: `scripts\/publish\.sh`, line 6$/m);
      assert.ok(!`${run.stdout}${run.stderr}`.includes(fakeLeakedToken));
    }
  ],
  [
    "check.failOn fails the job after the review is published",
    () => {
      const failing = runAction({}, { pull_request: { number: 7, base: { sha: fakeFailOnHighBaseSha } } });
      const writes = failing.requests.filter((request) => request.method !== "GET");

      // PR 7 edits .prism-review.yml and src/billing/charge.ts: two high-risk findings.
      assert.equal(failing.status, 1, failing.stderr);
      assert.equal(writes.length, 1);
      assert.equal(writes[0]?.method, "PATCH");
      assert.match(failing.stderr, /Prism Review found 1 high-risk finding\(s\), and check\.failOn is "high"\./);

      // dry-run prints the review instead of posting it, and the job still fails.
      const dryRun = runAction(
        { "INPUT_DRY-RUN": "true" },
        { pull_request: { number: 7, base: { sha: fakeFailOnHighBaseSha } } }
      );
      assert.equal(dryRun.status, 1, dryRun.stderr);
      assert.ok(dryRun.requests.every((request) => request.method === "GET"));
      assert.match(dryRun.stdout, /<!-- prism-review-comment -->/);
      assert.match(dryRun.stderr, /check\.failOn is "high"/);

      // The same pull request passes when the base configuration leaves check.failOn at "never".
      const passing = runAction({ "INPUT_DRY-RUN": "true" }, pullRequestEvent);
      assert.equal(passing.status, 0, passing.stderr);
      assert.doesNotMatch(passing.stderr, /check\.failOn/);
    }
  ],
  [
    "the CLI reviews a diff read from stdin",
    () => {
      // workDir has no .prism-review.yml, so the defaults apply.
      const run = runCli(["analyze", "--diff", "-"], riskyDiff);

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /^<!-- prism-review-comment -->/);
      assert.match(run.stdout, /^File: `src\/auth\/session\.ts`$/m);
      assert.equal(run.stderr, "");
    }
  ],
  [
    "the CLI applies check.failOn and still prints the review",
    () => {
      const config = writeConfig("fail-on-high.yml", "check:\n  failOn: high\n");
      const run = runCli(["analyze", "--diff", "-", "--config", config], riskyDiff);

      assert.equal(run.status, 1);
      assert.match(run.stdout, /#### High - Sensitive file changed/);
      assert.match(run.stderr, /check\.failOn is "high"/);
    }
  ],
  [
    "the CLI rejects a missing config file and unknown options",
    () => {
      const missing = runCli(["analyze", "--diff", "-", "--config", "missing.yml"], riskyDiff);
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /Configuration file not found: missing\.yml/);
      assert.equal(missing.stdout, "");

      const unknown = runCli(["analyze", "--difff", "-"], riskyDiff);
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /Unknown option: --difff/);
      assert.match(unknown.stderr, /Usage: prism-review analyze \(--diff <path\|-> \| --staged \| --base <ref>\)/);

      const help = runCli(["--help"]);
      assert.equal(help.status, 0);
      assert.match(help.stdout, /Usage: prism-review analyze \(--diff <path\|-> \| --staged \| --base <ref>\)/);
    }
  ],
  [
    "the CLI reads a large diff through a shell pipe",
    () => {
      // Larger than a pipe buffer, so stdin is read in several chunks, as with `git diff | ...`.
      const big = join(workDir, "big.diff");
      writeFileSync(big, riskyDiff.repeat(400));
      const result = spawnSync("sh", ["-c", 'cat "$1" | "$2" "$3" analyze --diff -', "sh", big, process.execPath, cliEntry], {
        cwd: workDir,
        encoding: "utf8",
        env: { PATH: process.env.PATH }
      });

      assert.ok(riskyDiff.repeat(400).length > 256 * 1024);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^File: `src\/auth\/session\.ts`$/m);
    }
  ],
  [
    "the CLI refuses input it cannot review instead of passing it",
    () => {
      const escape = String.fromCharCode(27);
      const cases: Array<[string, RegExp]> = [
        ["", /The diff is empty/],
        ["   \n", /The diff is empty/],
        ["src/a.ts | 2 +-\n 1 file changed\n", /No `diff --git` sections found/],
        [`${escape}[1mdiff --git a/x b/x${escape}[m\n`, /terminal color codes/],
        ["diff --git weird-header-with-no-paths\n+x\n", /Unrecognized diff header/]
      ];

      for (const [input, message] of cases) {
        const run = runCli(["analyze", "--diff", "-"], input);
        assert.equal(run.status, 1, JSON.stringify(input));
        assert.match(run.stderr, message);
        assert.equal(run.stdout, "");
      }
    }
  ],
  [
    "the CLI reviews real git output with quoted names and mnemonic prefixes",
    () => {
      const repo = join(workDir, "repo");
      const git = (...args: string[]) => {
        const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
      };
      const rlo = String.fromCodePoint(0x202e);

      spawnSync("git", ["init", "-q", repo]);
      git("config", "user.email", "smoke@example.com");
      git("config", "user.name", "Smoke");
      writeFileSync(join(repo, "README.md"), "base\n");
      git("add", ".");
      git("commit", "-qm", "base");
      writeFileSync(join(repo, `invoice${rlo}fdp.exe`), "payload\n");
      writeFileSync(join(repo, "README.md"), "base\nmore\n");
      git("add", ".");
      const diff = git("-c", "diff.mnemonicPrefix=true", "-c", "core.quotePath=true", "diff", "--cached");

      assert.match(diff, /^diff --git "c\/invoice\\342\\200\\256fdp\.exe"/m);
      const run = runCli(["analyze", "--diff", "-"], diff);

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /Reviewed 2 changed file\(s\)/);
      assert.match(run.stdout, /#### High - Hidden Unicode characters added/);
      assert.match(run.stdout, /^File: `invoice\\u\{202E\}fdp\.exe`$/m);
    }
  ],
  [
    "the CLI still accepts --fixture",
    () => {
      const run = runCli(["analyze", "--fixture", resolve("fixtures/diffs/risky-auth-change.diff")]);

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /^File: `src\/auth\/session\.ts`$/m);
    }
  ],
  [
    "the review is written to the job summary and step outputs",
    () => {
      const outputPath = join(workDir, "outputs.txt");
      const summaryPath = join(workDir, "summary.md");
      writeFileSync(outputPath, "");
      writeFileSync(summaryPath, "");

      const run = runAction({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath }, pullRequestEvent);
      const outputs = readFileSync(outputPath, "utf8");

      assert.equal(run.status, 0, run.stderr);
      assert.match(outputs, /^risk-level=high$/m);
      assert.match(outputs, /^high-count=1$/m);
      // One high (the configuration change), three warnings (large diff, missing tests, and
      // src/billing/charge.ts, which only a word in its path marks sensitive), and one info finding.
      assert.match(outputs, /^warning-count=3$/m);
      assert.match(outputs, /^finding-count=5$/m);
      assert.match(readFileSync(summaryPath, "utf8"), /^## Prism Review$/m);
    }
  ],
  [
    "a pull request from a fork that cannot be commented on still passes",
    () => {
      const summaryPath = join(workDir, "fork-summary.md");
      writeFileSync(summaryPath, "");
      const base = { sha: "1111111111111111111111111111111111111111" };
      const fork = { pull_request: { number: 13, base, head: { repo: { full_name: "someone/widgets" } } } };
      const onPullRequest = { GITHUB_EVENT_NAME: "pull_request" };

      const forkRun = runAction({ ...onPullRequest, GITHUB_STEP_SUMMARY: summaryPath }, fork);
      assert.equal(forkRun.status, 0, forkRun.stderr);
      assert.match(forkRun.stdout, /^::warning title=Prism Review::Could not post the review comment/m);
      assert.match(readFileSync(summaryPath, "utf8"), /^#### High - Sensitive file changed$/m);

      const deletedFork = runAction(onPullRequest, { pull_request: { number: 13, base, head: { repo: null } } });
      assert.equal(deletedFork.status, 0, deletedFork.stderr);

      // Each of these 403s is a real failure, not a read-only fork token.
      const failures: Array<[string, Record<string, string>, unknown]> = [
        ["same repository", onPullRequest, { pull_request: { number: 13, base, head: { repo: { full_name: "acme/widgets" } } } }],
        ["no head information", onPullRequest, { pull_request: { number: 13, base } }],
        ["pull_request_target", { GITHUB_EVENT_NAME: "pull_request_target" }, fork],
        ["rate limit", onPullRequest, { pull_request: { number: 15, base, head: { repo: { full_name: "someone/widgets" } } } }]
      ];
      for (const [name, env, event] of failures) {
        const run = runAction(env, event);
        assert.equal(run.status, 1, name);
        assert.match(run.stderr, /GitHub API request failed: 403/, name);
      }
    }
  ],
  [
    "a pull request with more files than GitHub returns is reported",
    () => {
      const run = runAction(
        { "INPUT_DRY-RUN": "true" },
        { pull_request: { ...pullRequestEvent.pull_request, number: 17, changed_files: 3500 } }
      );

      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.requests.filter((request) => request.path.startsWith("/repos/acme/widgets/pulls/17/files")).length, 30);
      assert.match(run.stdout, /#### High - Pull request too large to review fully\n\nThis pull request changes 3500 files, but GitHub returned 3000, so 500 files were not reviewed\./);

      // A count from the event that is higher than a short list is stale, not a truncated list.
      const stale = runAction(
        { "INPUT_DRY-RUN": "true" },
        { pull_request: { ...pullRequestEvent.pull_request, changed_files: 3500 } }
      );
      assert.equal(stale.status, 0, stale.stderr);
      assert.doesNotMatch(stale.stdout, /Pull request too large to review fully/);
    }
  ],
  [
    "the CLI reads owners from CODEOWNERS and generated files from .gitattributes",
    () => {
      const path = join(workDir, "CODEOWNERS");
      writeFileSync(path, "src/auth/ @acme/security\n");
      try {
        const run = runCli(["analyze", "--diff", "-"], riskyDiff);
        assert.equal(run.status, 0, run.stderr);
        assert.match(run.stdout, /^File: `src\/auth\/session\.ts`\n\nOwners: `@acme\/security`$/m);

        const off = runCli(["analyze", "--diff", "-", "--config", writeConfig("no-owners.yml", "comment:\n  codeOwners: false\n")], riskyDiff);
        assert.doesNotMatch(off.stdout, /Owners:/);

        // The local .gitattributes leaves generated files out, unless ignoreGenerated is off.
        writeFileSync(join(workDir, ".gitattributes"), "src/auth/** linguist-generated\n");
        const generated = runCli(["analyze", "--diff", "-"], riskyDiff);
        assert.match(generated.stdout, /^Reviewed 1 changed file\(s\), 1 more marked generated or vendored in \.gitattributes\./m);
        assert.doesNotMatch(generated.stdout, /Sensitive file changed/);
        const reviewed = runCli(["analyze", "--diff", "-", "--config", writeConfig("all.yml", "ignoreGenerated: false\n")], riskyDiff);
        assert.match(reviewed.stdout, /Sensitive file changed/);
      } finally {
        rmSync(path);
        rmSync(join(workDir, ".gitattributes"), { force: true });
      }
    }
  ],
  [
    "the CLI prints JSON and SARIF and keeps the gate",
    () => {
      const config = writeConfig("formats.yml", "check:\n  failOn: high\n");
      const json = runCli(["analyze", "--diff", "-", "--config", config, "--format", "json"], riskyDiff);
      assert.equal(json.status, 1, json.stderr);
      const parsed = JSON.parse(json.stdout) as { riskLevel: string; findings: Array<{ ruleId: string }> };
      assert.equal(parsed.riskLevel, "high");
      assert.ok(parsed.findings.some((finding) => finding.ruleId === "sensitive-files"));

      const sarif = runCli(["analyze", "--diff", "-", "--format", "sarif"], riskyDiff);
      assert.equal(sarif.status, 0, sarif.stderr);
      const report = JSON.parse(sarif.stdout) as { version: string; runs: Array<{ results: unknown[] }> };
      assert.equal(report.version, "2.1.0");
      assert.ok((report.runs[0]?.results.length ?? 0) > 0);

      const unknown = runCli(["analyze", "--diff", "-", "--format", "xml"], riskyDiff);
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /Unknown format: xml/);
    }
  ],
  [
    "the action writes a SARIF report when sarif-file is set",
    () => {
      const workspace = join(workDir, "workspace");
      const run = runAction(
        { "INPUT_DRY-RUN": "true", "INPUT_SARIF-FILE": "reports/prism.sarif", GITHUB_WORKSPACE: workspace },
        pullRequestEvent
      );
      assert.equal(run.status, 0, run.stderr);
      const report = JSON.parse(readFileSync(join(workspace, "reports/prism.sarif"), "utf8")) as {
        runs: Array<{ results: Array<{ ruleId: string }> }>;
      };
      assert.ok(report.runs[0]?.results.some((result) => result.ruleId === "config-change"));

      const escape = runAction({ "INPUT_DRY-RUN": "true", "INPUT_SARIF-FILE": "../outside.sarif", GITHUB_WORKSPACE: workspace }, pullRequestEvent);
      assert.equal(escape.status, 1);
      assert.match(escape.stderr, /Invalid sarif-file/);
    }
  ],
  [
    "line findings become review comments that are updated in place",
    () => {
      const run = runAction({}, { pull_request: { number: 21, base: { sha: fakeReviewCommentsBaseSha }, head: { sha: fakeHeadSha } } });
      assert.equal(run.status, 0, run.stderr);

      const posted = run.requests.filter((request) => request.method === "POST" && request.path === "/repos/acme/widgets/pulls/21/comments");
      assert.equal(posted.length, 2);
      const body = posted[0]?.body as unknown as { commit_id: string; path: string; line: number; side: string; body: string };
      assert.equal(body.commit_id, fakeHeadSha);
      assert.equal(body.side, "RIGHT");
      assert.equal(body.line, 1);
      assert.match(body.body, /^<!-- prism-review-line sql-injection -->\n\*\*Warning\*\* - SQL built from values/);

      const resolved = run.requests.find((request) => request.method === "PATCH" && request.path === "/repos/acme/widgets/pulls/comments/77");
      assert.match(resolved?.body?.body ?? "", /resolved -->\nThis finding is no longer reported/);
      assert.ok(!run.requests.some((request) => request.method === "DELETE"));
      assert.match(run.stdout, /Review comments: 1 posted, 0 updated, 1 marked resolved\./);
      assert.match(run.stdout, /::warning title=Prism Review::1 line finding\(s\) are outside the diff/);
    }
  ],
  [
    "the review marks findings that are new since the previous review",
    () => {
      const run = runAction({}, { pull_request: { number: 23, base: { sha: fakeComparisonBaseSha } } });
      assert.equal(run.status, 0, run.stderr);

      const update = run.requests.find((request) => request.method === "PATCH" && request.path === "/repos/acme/widgets/issues/comments/30");
      const body = update?.body?.body ?? "";
      assert.match(body, /^Since the previous review: 1 new finding\(s\), 1 no longer reported \(`secret-in-diff` \(1\)\)\.$/m);
      // Only a word in its path marks src/billing/charge.ts sensitive, so it is a warning.
      assert.match(body, /^#### Warning - Sensitive file changed \(new\)$/m);
      // .gitattributes on the base commit marks src/gen as generated.
      assert.match(body, /^Reviewed 1 changed file\(s\), 1 more marked generated or vendored in \.gitattributes\./m);
      assert.doesNotMatch(body, /src\/gen\/client\.ts/);
      // The owners come from CODEOWNERS on the base commit, in code spans so nobody is notified.
      assert.match(body, /^File: `src\/billing\/charge\.ts`\n\nOwners: `@acme\/payments`$/m);
      assert.match(body, /^- Have the code owners of the flagged files, `@acme\/payments`, reviewed the change\?$/m);
      assert.match(body, /^#### Warning - Source changed without tests$/m);
      // The comment records this run's findings for the next one.
      assert.match(body, /\n<!-- prism-review-state v1 missing-tests:[0-9a-f]{12} sensitive-files:[0-9a-f]{12} -->$/);
    }
  ],
  [
    "release notes come from the changelog, and the action has Marketplace branding",
    () => {
      const notes = (version: string) =>
        spawnSync(process.execPath, [resolve("scripts/release-notes.mjs"), version], { encoding: "utf8" });

      // Every version in the changelog has notes, so its release can be created.
      const versions = [...readFileSync("CHANGELOG.md", "utf8").matchAll(/^## (\d+\.\d+\.\d+)\b/gm)].map((match) => match[1] ?? "");
      assert.ok(versions.length > 10);
      for (const version of versions) {
        const run = notes(`v${version}`);
        assert.equal(run.status, 0, `${version}: ${run.stderr}`);
        assert.match(run.stdout, /^### /, version);
        assert.doesNotMatch(run.stdout, /^## /m, version);
      }
      assert.match(notes("0.14.1").stdout, /^### Fixed\n\n- Several rule patterns took time quadratic/);
      assert.equal(notes("v9.9.9").status, 1);
      assert.equal(notes("latest").status, 1);

      // The values GitHub Marketplace accepts.
      const branding = parseYaml(readFileSync("action.yml", "utf8")).branding as { icon: string; color: string };
      assert.ok(["white", "black", "yellow", "blue", "green", "orange", "red", "purple", "gray-dark"].includes(branding.color));
      assert.equal(branding.icon, "shield");
    }
  ],
  [
    "a dependency change without its lockfile is reported",
    () => {
      const run = runAction({}, { pull_request: { number: 25, base: { sha: fakeLockfileBaseSha } } });
      assert.equal(run.status, 0, run.stderr);

      // Only the manifest's directory, the root here, is listed.
      const listings = run.requests.filter((request) => request.path.startsWith("/repos/acme/widgets/contents?"));
      assert.deepEqual(listings.map((request) => request.path), [`/repos/acme/widgets/contents?ref=${fakeLockfileBaseSha}`]);

      const posted = run.requests.find((request) => request.method === "POST" && request.path === "/repos/acme/widgets/issues/25/comments");
      const body = String(posted?.body?.body);
      assert.match(body, /^#### Warning - Lockfile not updated$/m);
      assert.match(body, /This file changes dependencies \(axios added\), but package-lock\.json, which pins/);
      assert.match(body, /^\| `package\.json` \| `axios` \| added `\^1\.6\.0` \|$/m);
    }
  ],
  [
    "the AI summary is added when it is enabled and given a key",
    () => {
      const run = runAction({ "INPUT_AI-API-KEY": "sk-test-key" }, { pull_request: { number: 27, base: { sha: fakeAiBaseSha } } });
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /^::add-mask::sk-test-key$/m);

      const sent = run.requests.filter((request) => request.path.startsWith("/v1/messages"));
      assert.equal(sent.length, 1);
      assert.match(sent[0]?.url ?? "", /^https:\/\/api\.anthropic\.com\/v1\/messages/);
      const request = sent[0]?.body as { model?: string; messages?: Array<{ content: string }> } | undefined;
      assert.equal(request?.model, "claude-opus-5-5");
      assert.match(request?.messages?.[0]?.content ?? "", /\+export const refundLimit = 500;/);

      const posted = run.requests.find((entry) => entry.method === "POST" && entry.path === "/repos/acme/widgets/issues/27/comments");
      const body = String(posted?.body?.body);
      assert.match(body, /^### AI Summary$/m);
      assert.match(body, /^Raises the refund limit; cc `@acme\/finance`\.$/m);
      assert.match(body, /^- `src\/billing\/refund\.ts`: No test covers the new limit\.$/m);
    }
  ],
  [
    "without a key, the review says why it has no AI summary",
    () => {
      const run = runAction({}, { pull_request: { number: 27, base: { sha: fakeAiBaseSha } } });
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /::notice title=Prism Review::ai\.enabled is set, but the ai-api-key input is empty/);
      assert.ok(!run.requests.some((request) => request.path.startsWith("/v1/messages")));

      const posted = run.requests.find((entry) => entry.method === "POST" && entry.path === "/repos/acme/widgets/issues/27/comments");
      assert.doesNotMatch(String(posted?.body?.body), /AI Summary/);
    }
  ],
  [
    "a failed AI request leaves the summary out and still posts the review",
    () => {
      const run = runAction({ "INPUT_AI-API-KEY": "sk-test-key" }, { pull_request: { number: 27, base: { sha: fakeAiFailureBaseSha } } });
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /::warning title=Prism Review::The review has no AI summary: 400 /);

      const posted = run.requests.find((entry) => entry.method === "POST" && entry.path === "/repos/acme/widgets/issues/27/comments");
      const body = String(posted?.body?.body);
      assert.match(body, /^## Prism Review$/m);
      assert.doesNotMatch(body, /AI Summary/);
    }
  ],
  [
    "events other than pull_request are skipped",
    () => {
      const run = runAction({}, { ref: "refs/heads/master" });

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /Prism Review only runs on pull_request events\./);
      assert.equal(run.requests.length, 0);
    }
  ],
  [
    "the CLI prints the version in package.json",
    () => {
      const run = runCli(["--version"]);

      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout, `${JSON.parse(readFileSync("package.json", "utf8")).version}\n`);
    }
  ],
  [
    "init sets up a repository and leaves existing files alone",
    () => {
      const repo = join(workDir, "init-repo");
      const init = (...args: string[]) =>
        spawnSync(process.execPath, [cliEntry, "init", ...args], {
          cwd: repo,
          encoding: "utf8",
          env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
        });
      mkdirSync(repo);

      const outside = init("--ref", "v0");
      assert.equal(outside.status, 1);
      assert.match(outside.stderr, /root of a Git repository/);

      spawnSync("git", ["init", "-q", repo]);
      const first = init("--ref", "v0");
      assert.equal(first.status, 0, first.stderr);
      assert.match(first.stdout, /^Created \.github\/workflows\/prism-review\.yml$/m);
      assert.match(first.stdout, /^Created \.prism-review\.yml$/m);
      const workflow = parseYaml(readFileSync(join(repo, ".github/workflows/prism-review.yml"), "utf8"));
      assert.equal(workflow.jobs.review.steps[0].uses, "gabrielolvv/prism-review@v0");

      const second = init("--ref", "v0");
      assert.equal(second.status, 0, second.stderr);
      assert.doesNotMatch(second.stdout, /Created/);
      assert.match(second.stdout, /Left \.prism-review\.yml unchanged/);

      const unknown = init("--pin");
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /Unknown option: --pin/);
    }
  ],
  [
    "the CLI reviews staged changes and a branch, and --fail-on sets the exit status",
    () => {
      const repo = join(workDir, "git-sources");
      const git = (...args: string[]) => {
        const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      const cli = (...args: string[]) =>
        spawnSync(process.execPath, [cliEntry, "analyze", ...args], {
          cwd: repo,
          encoding: "utf8",
          env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
        });
      const workflow = ["on: pull_request_target", "jobs:", "  x:", "    runs-on: ubuntu-latest", "    steps:", '      - run: echo "${{ github.event.pull_request.title }}"', ""].join("\n");

      spawnSync("git", ["init", "-q", "-b", "main", repo]);
      git("config", "user.email", "smoke@example.com");
      git("config", "user.name", "Smoke");
      // Colors and an external diff tool must not reach the review.
      git("config", "color.diff", "always");
      git("config", "diff.external", "false");
      writeFileSync(join(repo, "README.md"), "base\n");
      git("add", ".");
      git("commit", "-qm", "base");

      const nothing = cli("--staged");
      assert.equal(nothing.status, 0, nothing.stderr);
      assert.equal(nothing.stdout, "No changes to review.\n");

      mkdirSync(join(repo, ".github/workflows"), { recursive: true });
      writeFileSync(join(repo, ".github/workflows/x.yml"), workflow);
      git("add", ".");
      const staged = cli("--staged");
      assert.equal(staged.status, 0, staged.stderr);
      assert.match(staged.stdout, /Risky workflow change/);
      const blocked = cli("--staged", "--fail-on", "high");
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /high-risk finding\(s\), and --fail-on is "high"\./);

      git("checkout", "-qb", "feature");
      git("commit", "-qm", "workflow");
      const branch = cli("--base", "main", "--format", "json");
      assert.equal(branch.status, 0, branch.stderr);
      assert.ok(JSON.parse(branch.stdout).findings.some((finding: { ruleId: string }) => finding.ruleId === "workflow-risk"));

      for (const [args, message] of [
        [[], /Missing --diff, --staged, or --base\./],
        [["--staged", "--base", "main"], /Use only one of --diff, --staged, and --base\./],
        [["--base", "--output=x"], /--base needs a branch/],
        [["--staged", "--fail-on", "always"], /--fail-on needs never, warning, or high\./]
      ] as Array<[string[], RegExp]>) {
        const run = cli(...args);
        assert.equal(run.status, 1, args.join(" "));
        assert.match(run.stderr, message);
      }
      const missing = cli("--base", "no-such-branch");
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /git diff failed/);
    }
  ],
  [
    "the CLI prints text for a terminal, colored unless NO_COLOR is set",
    () => {
      const cli = (args: string[], env: Record<string, string> = {}) =>
        spawnSync(process.execPath, [cliEntry, "analyze", "--diff", "-", ...args], {
          cwd: workDir,
          encoding: "utf8",
          input: riskyDiff,
          env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...env }
        });
      const escape = String.fromCharCode(27);

      // A pipe keeps the Markdown it always got.
      assert.match(cli([]).stdout, /^## Prism Review$/m);

      const text = cli(["--format", "text"]);
      assert.equal(text.status, 0, text.stderr);
      assert.match(text.stdout, /^Prism Review: high risk\. Reviewed 2 changed file\(s\)/);
      assert.match(text.stdout, /^high {5}src\/auth\/session\.ts {2}Sensitive file changed \[sensitive-files\]$/m);
      assert.ok(!text.stdout.includes(escape));

      assert.ok(cli(["--format", "text"], { FORCE_COLOR: "1" }).stdout.includes(`${escape}[1;31m`));
      assert.ok(!cli(["--format", "text"], { FORCE_COLOR: "1", NO_COLOR: "1" }).stdout.includes(escape));
      assert.ok(!cli(["--format", "text"], { FORCE_COLOR: "0" }).stdout.includes(escape));

      const unknown = cli(["--format", "html"]);
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /Unknown format: html\. Use text, markdown, json, or sarif\./);
    }
  ],
  [
    "the CLI follows extends to a file in the repository",
    () => {
      const repo = join(workDir, "extends");
      mkdirSync(join(repo, ".github"), { recursive: true });
      writeFileSync(join(repo, ".prism-review.yml"), "extends: .github/prism-review-base.yml\ncomment:\n  includeLowSeverity: false\n");
      writeFileSync(join(repo, ".github/prism-review-base.yml"), "check:\n  failOn: high\n");
      const cli = (diff: string) =>
        spawnSync(process.execPath, [cliEntry, "analyze", "--diff", "-", "--format", "text"], {
          cwd: repo,
          encoding: "utf8",
          input: diff,
          env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
        });

      // check.failOn comes from the extended file.
      const risky = cli(riskyDiff);
      assert.equal(risky.status, 1);
      assert.match(risky.stderr, /check\.failOn is "high"/);

      // Changing the extended file changes later reviews, so it is reported like the configuration.
      const base = cli(["diff --git a/.github/prism-review-base.yml b/.github/prism-review-base.yml", "--- a/.github/prism-review-base.yml", "+++ b/.github/prism-review-base.yml", "@@ -1,2 +1,2 @@", " check:", "-  failOn: high", "+  failOn: never", ""].join("\n"));
      assert.match(base.stdout, /\.github\/prism-review-base\.yml {2}Review configuration changed \[config-change\]/);

      writeFileSync(join(repo, ".prism-review.yml"), "extends: missing.yml\n");
      const missing = cli(riskyDiff);
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /extends missing\.yml, which was not found\./);
    }
  ],
  [
    "the pre-commit hook runs the CLI with its own arguments",
    () => {
      const [hook] = parseYaml(readFileSync(".pre-commit-hooks.yaml", "utf8"));
      assert.equal(hook.id, "prism-review");
      assert.equal(hook.language, "node");
      assert.equal(hook.pass_filenames, false);
      assert.equal(hook.entry, `${Object.keys(JSON.parse(readFileSync("package.json", "utf8")).bin)[0]} analyze --format text`);
      assert.deepEqual(hook.args, ["--staged", "--fail-on", "high"]);
    }
  ]
];

try {
  for (const [name, scenario] of scenarios) {
    scenario();
    console.log(`ok - ${name}`);
  }

  console.log(`${scenarios.length} action and CLI smoke test(s) passed.`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
