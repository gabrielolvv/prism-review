import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  fakeAnnotationsBaseSha,
  fakeAppendBaseSha,
  fakeBaseSha,
  fakeLeakedToken
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
    "events other than pull_request are skipped",
    () => {
      const run = runAction({}, { ref: "refs/heads/master" });

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /Prism Review only runs on pull_request events\./);
      assert.equal(run.requests.length, 0);
    }
  ]
];

try {
  for (const [name, scenario] of scenarios) {
    scenario();
    console.log(`ok - ${name}`);
  }

  console.log(`${scenarios.length} action smoke test(s) passed.`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
