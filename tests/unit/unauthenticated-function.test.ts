import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unauthenticatedFunctionRule } from "../../src/rules/unauthenticated-function.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unauthenticatedFunctionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUnauthenticatedFunctionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/lambda.tf", [
      "resource \"aws_lambda_function_url\" \"export\" {",
      "  function_name      = aws_lambda_function.export.function_name",
      "  authorization_type = \"NONE\"",
      "}",
      "resource \"aws_api_gateway_method\" \"health\" {",
      "  authorization = \"NONE\"",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Function open to anyone");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 lets anyone on the internet call an AWS Lambda function URL without authentication, so unless the function checks each caller itself, such as a webhook's signature or a token, anyone can run it, read what it returns, and run up its bill."
  );
}

export function testUnauthenticatedFunctionReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["template.yaml", ["      FunctionUrlConfig:", "        AuthType: NONE"]],
    ["lib/stack.ts", ["const url = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });"]],
    ["serverless.yml", ["functions:", "  export:", "    handler: handler.export", "    url: true"]],
    ["scripts/deploy.sh", ["gcloud run deploy api --image gcr.io/acme/api --region us-central1 --allow-unauthenticated"]],
    [".github/workflows/deploy.yml", ["      - uses: google-github-actions/deploy-cloudrun@v2", "        with:", "          flags: --allow-unauthenticated"]],
    ["ExportFunction/function.json", ["{ \"bindings\": [{ \"type\": \"httpTrigger\", \"authLevel\": \"anonymous\" }] }"]],
    ["function_app.py", ["@app.route(route='export', auth_level=func.AuthLevel.ANONYMOUS)"]],
    ["src/functions/export.ts", ["import { app } from '@azure/functions';", "app.http('export', { methods: ['GET'], authLevel: 'anonymous', handler });"]],
    ["Functions/Export.cs", ["    public IActionResult Run([HttpTrigger(AuthorizationLevel.Anonymous, \"get\")] HttpRequest req)"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnauthenticatedFunctionSkipsAuthenticatedFunctions(): void {
  const cases: Array<[string, string[]]> = [
    ["infra/lambda.tf", ["resource \"aws_lambda_function_url\" \"export\" {", "  authorization_type = \"AWS_IAM\"", "}"]],
    ["template.yaml", ["        AuthType: AWS_IAM"]],
    ["scripts/deploy.sh", ["gcloud run deploy api --image gcr.io/acme/api --no-allow-unauthenticated"]],
    ["ExportFunction/function.json", ["{ \"bindings\": [{ \"type\": \"httpTrigger\", \"authLevel\": \"function\" }] }"]],
    // Other `authorization_type` and `authLevel` settings.
    ["infra/api.tf", ["  authorization_type = \"NONE\""]],
    ["src/config.ts", ["const options = { authLevel: 'anonymous' };"]],
    // Examples in Python docstrings.
    ["aws_cdk/origins.py", ["    \"\"\"Example::", "        fn_url = fn.add_function_url(auth_type=lambda_.FunctionUrlAuthType.NONE)", "    \"\"\""]],
    // Documentation, examples, and tests.
    ["README.md", ["gcloud run deploy api --allow-unauthenticated"]],
    ["examples/hello/serverless.yml", ["    url: true"]],
    ["tests/test_app.py", ["@app.route(route='x', auth_level=func.AuthLevel.ANONYMOUS)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnauthenticatedFunctionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { unauthenticatedFunction: { enabled: false } } });
  assert.deepEqual(findings([added("template.yaml", ["        AuthType: NONE"])], config), []);
}
