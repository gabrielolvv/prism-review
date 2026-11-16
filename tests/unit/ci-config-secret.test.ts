import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { ciConfigSecretRule } from "../../src/rules/ci-config-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return ciConfigSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const workflow = (...steps: string[]) => ["name: deploy", "on: push", "jobs:", "  deploy:", "    runs-on: ubuntu-latest", "    steps:", ...steps];

export function testCiConfigSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(".github/workflows/deploy.yml", workflow("      - run: ./deploy.sh", "        env:", "          DEPLOY_REGION: eu-west-1", "          DEPLOY_TOKEN: Tr0ub4dor-staging"))
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Secret written into a CI pipeline");
  assert.deepEqual(finding?.lines, [10]);
  assert.equal(
    finding?.message,
    "Line 10 writes `DEPLOY_TOKEN` into the CI pipeline in plain text instead of reading it from the CI's secrets, so the value is committed to the repository, where anyone who can read it, a fork, or its history can use it, and the CI cannot mask it in its logs."
  );
  assert.doesNotMatch(finding?.message ?? "", /Tr0ub4dor/);
}

export function testCiConfigSecretReadsEachPipeline(): void {
  const cases: Array<[string, string[]]> = [
    [".github/workflows/release.yml", workflow("      - uses: acme/publish-action@v2", "        with:", "          api-key: Tr0ub4dor-staging")],
    [".gitlab-ci.yml", ["variables:", "  REGISTRY_PASSWORD: Tr0ub4dor-staging", "build:", "  script: make"]],
    [".gitlab-ci.yml", ["variables:", "  SENTRY_AUTH_TOKEN:", "    value: \"Tr0ub4dor-staging\"", "    description: Sentry upload token"]],
    [".circleci/config.yml", ["jobs:", "  deploy:", "    environment:", "      HEROKU_API_KEY: Tr0ub4dor-staging"]],
    ["azure-pipelines.yml", ["variables:", "  - name: NUGET_API_KEY", "    value: Tr0ub4dor-staging"]],
    [".drone.yml", ["steps:", "  - name: publish", "    environment:", "      NPM_TOKEN: Tr0ub4dor-staging"]],
    [".travis.yml", ["env:", "  global:", "    - CODECOV_TOKEN=Tr0ub4dor-staging"]],
    ["Jenkinsfile", ["pipeline {", "  environment {", "    SONAR_TOKEN = 'Tr0ub4dor-staging'", "  }", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testCiConfigSecretSkipsSecretReferencesAndServices(): void {
  const cases: Array<[string, string[]]> = [
    // Values read from the CI's secrets and variables.
    [".github/workflows/deploy.yml", workflow("      - run: ./deploy.sh", "        env:", "          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}")],
    [".github/workflows/deploy.yml", workflow("      - uses: actions/checkout@v4", "        with:", "          token: ${{ github.token }}")],
    [".gitlab-ci.yml", ["variables:", "  REGISTRY_PASSWORD: $CI_REGISTRY_PASSWORD"]],
    ["azure-pipelines.yml", ["variables:", "  - name: NUGET_API_KEY", "    value: $(NugetApiKey)"]],
    ["Jenkinsfile", ["pipeline {", "  environment {", "    SONAR_TOKEN = credentials('sonar-token')", "  }", "}"]],
    // Service containers and the database passwords that tests use.
    [".github/workflows/test.yml", ["jobs:", "  test:", "    services:", "      postgres:", "        image: postgres:16", "        env:", "          APP_DB_PASSWORD: Tr0ub4dor-staging"]],
    [".gitlab-ci.yml", ["variables:", "  POSTGRES_PASSWORD: Tr0ub4dor-staging", "  MYSQL_ROOT_PASSWORD: Tr0ub4dor-staging"]],
    // Names of secrets kept elsewhere, Jenkins credential IDs, and FOSSA's push-only keys.
    [".drone.yml", ["steps:", "  - name: publish", "    environment:", "      GCLOUD_AUTH:", "        from_secret: gcloud_auth"]],
    [".github/workflows/e2e.yml", workflow("      - uses: acme/install-action@v1", "        with:", "          image-pull-secret: \"acme-registry\"")],
    ["Jenkinsfile", ["pipeline {", "  environment {", "    JOB_GCS_CREDENTIALS = 'ci-gcs-plugin'", "  }", "}"]],
    [".github/workflows/scan.yml", workflow("      - uses: fossas/fossa-action@v1", "        with:", "          fossa-api-key: 5ee8bf422db1471e0bcf2bcb289185de")],
    // Placeholders, test values, and settings outside environment blocks.
    [".github/workflows/test.yml", workflow("      - run: npm test", "        env:", "          API_TOKEN: test-token")],
    [".github/workflows/deploy.yml", workflow("      - run: ./deploy.sh --token Tr0ub4dor-staging")],
    // Other YAML files.
    ["config/settings.yml", ["env:", "  API_TOKEN: Tr0ub4dor-staging"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testCiConfigSecretFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `token: ...` and `api-key: ...`, so the values are read first.
  const files = prepareChangedFiles([added(".github/workflows/release.yml", workflow("      - uses: acme/publish-action@v2", "        with:", "          token: Tr0ub4dor-staging"))], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "ci-config-secret");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [9]);
}

export function testCiConfigSecretSkipsExamplesAndCanBeDisabled(): void {
  const lines = ["variables:", "  REGISTRY_PASSWORD: Tr0ub4dor-staging"];
  assert.deepEqual(findings([added("examples/gitlab/.gitlab-ci.yml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { ciConfigSecret: { enabled: false } } });
  assert.deepEqual(findings([added(".gitlab-ci.yml", lines)], config), []);
}
