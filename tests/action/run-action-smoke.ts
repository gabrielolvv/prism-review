import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fakeBaseSha } from "../support/fake-github-api.js";

// Runs the committed bundle the way the runner does, against a fake GitHub API.
const actionEntry = resolve("dist/action/index.cjs");
const fakeApi = pathToFileURL(resolve("build/tests/support/fake-github-api.js")).href;
const workDir = mkdtempSync(join(tmpdir(), "prism-review-smoke-"));

type FakeRequest = {
  method: string;
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
      assert.match(run.stdout, /Review configuration changed/);
      // Only the base configuration sets maxFiles to 1.
      assert.match(run.stdout, /Large pull request/);
      assert.doesNotMatch(run.stdout, /sk-thisShouldNeverAppear/);
      assert.ok(run.requests.every((request) => request.method === "GET"));
      assert.ok(run.requests.every((request) => request.authorization === "Bearer test-token"));
    }
  ],
  [
    "publishing posts one marked comment",
    () => {
      const run = runAction({}, pullRequestEvent);
      const posts = run.requests.filter((request) => request.method === "POST");

      assert.equal(run.status, 0, run.stderr);
      assert.equal(posts.length, 1);
      assert.equal(posts[0]?.path, "/repos/acme/widgets/issues/7/comments");
      assert.match(posts[0]?.body?.body ?? "", /<!-- prism-review-comment -->/);
    }
  ],
  [
    "a missing base configuration falls back to defaults",
    () => {
      const run = runAction(
        { "INPUT_DRY-RUN": "true", "INPUT_CONFIG-PATH": "config/prism.yml" },
        pullRequestEvent
      );

      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /No config\/prism\.yml on the base branch; using the default configuration\./);
      assert.doesNotMatch(run.stdout, /Large pull request/);
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
