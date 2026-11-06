import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { ciScriptInjectionRule } from "../../src/rules/ci-script-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return ciScriptInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testCiScriptInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("azure-pipelines.yml", [
      "pr:",
      "  - main",
      "steps:",
      "  - script: echo \"Building $(System.PullRequest.SourceBranch)\"",
      "  - bash: |",
      "      echo \"$(Build.SourceVersionMessage)\" > notes.txt",
      "    displayName: Save notes"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "CI script runs text from a pull request");
  assert.deepEqual(finding?.lines, [4, 6]);
  assert.equal(
    finding?.message,
    "Lines 4, 6 paste the commit message, branch, or title into an Azure Pipelines script before the shell runs it, so a pull request named `\"; printenv; #` runs its own commands in the pipeline, with its secrets and its access to deploy."
  );
}

export function testCiScriptInjectionReadsEachSystem(): void {
  const cases: Array<[string, string[]]> = [
    ["Jenkinsfile", ["pipeline {", "  stages {", "    stage('Notify') {", "      steps {", "        sh \"echo Building ${env.CHANGE_TITLE}\"", "      }", "    }", "  }", "}"]],
    ["Jenkinsfile", ["        sh \"\"\"", "          git checkout ${CHANGE_BRANCH}", "        \"\"\""]],
    ["ci/release.jenkinsfile", ["sh(script: \"./notify.sh '${ghprbPullTitle}'\")"]],
    [".drone.yml", ["steps:", "  - name: notify", "    image: alpine:3.20", "    commands:", "      - echo ${DRONE_COMMIT_MESSAGE}"]],
    [".woodpecker/build.yml", ["steps:", "  build:", "    commands:", "    - ./build.sh \"${CI_COMMIT_SOURCE_BRANCH}\""]],
    [".circleci/config.yml", ["jobs:", "  notify:", "    steps:", "      - run: echo \"<< pipeline.trigger_parameters.github_app.commit_message >>\""]],
    ["eng/pipelines/build.yml", ["steps:", "  - pwsh: Write-Host '${{ variables['Build.SourceVersionMessage'] }}'"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testCiScriptInjectionSkipsSafeUses(): void {
  const cases: Array<[string, string[]]> = [
    // Environment variables the shell reads as data.
    ["azure-pipelines.yml", ["steps:", "  - script: echo \"$SOURCE_BRANCH\"", "    env:", "      SOURCE_BRANCH: $(System.PullRequest.SourceBranch)"]],
    ["Jenkinsfile", ["        sh 'echo \"$CHANGE_TITLE\"'"]],
    ["Jenkinsfile", ["        sh \"echo \\${CHANGE_TITLE}\""]],
    [".drone.yml", ["steps:", "  - name: notify", "    commands:", "      - echo $${DRONE_COMMIT_MESSAGE}", "      - echo $DRONE_COMMIT_MESSAGE"]],
    // Values outside scripts, such as names and conditions.
    ["azure-pipelines.yml", ["steps:", "  - script: make", "    displayName: Build $(System.PullRequest.SourceBranch)"]],
    ["Jenkinsfile", ["  echo \"Building ${env.CHANGE_TITLE}\"", "  currentBuild.description = \"${env.CHANGE_TITLE}\""]],
    [".drone.yml", ["steps:", "  - name: notify", "    when:", "      branch: ${DRONE_BRANCH}"]],
    // Values the author does not choose, comments, and GitHub Actions, which `workflow-risk` reads.
    ["azure-pipelines.yml", ["steps:", "  - script: echo \"$(Build.BuildId)\""]],
    ["Jenkinsfile", ["        // sh \"echo ${env.CHANGE_TITLE}\""]],
    [".github/workflows/ci.yml", ["      - run: echo \"$(Build.SourceVersionMessage)\""]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testCiScriptInjectionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { ciScriptInjection: { enabled: false } } });
  assert.deepEqual(findings([added("Jenkinsfile", ["sh \"echo ${env.CHANGE_TITLE}\""])], config), []);
}
