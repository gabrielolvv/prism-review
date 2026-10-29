import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { dockerfileRiskRule } from "../../src/rules/dockerfile-risk.js";

function dockerfile(path: string, lines: string[], startLine = 1): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: 0,
    patch: [`@@ -${startLine},1 +${startLine},${lines.length} @@`, ...lines].join("\n")
  };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return dockerfileRiskRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testDockerfileRiskReportsEachKind(): void {
  const [finding, ...rest] = findings([
    dockerfile("Dockerfile", [
      "+FROM node AS build",
      "+FROM --platform=linux/amd64 python:latest",
      "+ADD https://example.com/tool.tar.gz /opt/",
      "+ENV DB_PASSWORD=hunter2 LOG_LEVEL=info",
      "+ARG NPM_TOKEN",
      "+USER root"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.ruleId, "dockerfile-risk");
  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [1, 2, 3, 4, 5, 6]);
  assert.equal(
    finding?.message,
    "Lines 1, 2, 3, 4, 5 and 1 more add a base image without a version tag or with `latest`, a file downloaded by `ADD` without a checksum, a secret in `ENV` or `ARG`, which the image and its history keep, and a final `USER` that runs the image as root."
  );
}

export function testDockerfileRiskSkipsSafeInstructions(): void {
  const safe = [
    // Pinned images, digests, variables, scratch, a registry port, and stages built in the same file.
    "+FROM node:20-alpine AS build",
    "+FROM registry.example.com:5000/team/app:1.4.2",
    "+FROM python@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "+FROM ${BASE_IMAGE}",
    "+FROM scratch",
    "+FROM build AS final",
    // A checked download, a local ADD, and COPY from a URL-like path.
    "+ADD --checksum=sha256:abc123 https://example.com/tool.tar.gz /opt/",
    "+ADD ./vendor /opt/vendor",
    // Names that only mention where a secret lives, public keys, and words inside quoted values.
    "+ENV TOKEN_FILE=/run/secrets/token GPG_PUBLIC_KEY=abc",
    '+ENV MESSAGE="pass the token at run time" PATH=/app/bin:$PATH',
    "+ARG VERSION=1.0",
    "+# USER root",
    // USER root that a later USER switches away from.
    "+USER root",
    "+RUN apt-get update",
    "+USER app"
  ];

  assert.deepEqual(findings([dockerfile("Dockerfile", safe)]), []);
}

export function testDockerfileRiskReadsContinuedLinesAndContext(): void {
  // A continued ENV is one instruction, reported on its first line; context lines are not changes.
  const [finding] = findings([
    dockerfile(
      "services/api/Dockerfile.prod",
      [" FROM node", "+ENV NODE_ENV=production \\", "+    STRIPE_SECRET_KEY=sk_live_placeholder", " USER root"],
      10
    )
  ]);
  assert.deepEqual(finding?.lines, [11]);
  assert.match(finding?.message ?? "", /^Line 11 adds a secret in `ENV` or `ARG`/);

  // An added USER root is reported when no later USER shows in the diff.
  assert.deepEqual(findings([dockerfile("api.dockerfile", ["+USER 0:0", " CMD [\"node\", \"server.js\"]"])])[0]?.lines, [1]);
}

export function testDockerfileRiskOnlyReadsDockerfiles(): void {
  const lines = ["+FROM node", "+USER root"];

  assert.equal(findings([dockerfile("Containerfile", lines)]).length, 1);
  assert.equal(findings([dockerfile("docker/worker.Dockerfile", lines)]).length, 1);
  assert.deepEqual(findings([dockerfile("docs/docker.md", lines)]), []);
  assert.deepEqual(findings([dockerfile("tests/fixtures/Dockerfile", lines)]), []);
  assert.deepEqual(findings([dockerfile("Dockerfile", lines)], prismConfigSchema.parse({ rules: { dockerfileRisk: { enabled: false } } })), []);

  const result = analyzePullRequest([dockerfile("Dockerfile", lines)], defaultConfig);
  assert.ok(result.findings.some((entry) => entry.ruleId === "dockerfile-risk"));
}
