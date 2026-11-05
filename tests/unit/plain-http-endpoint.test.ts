import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { plainHttpEndpointRule } from "../../src/rules/plain-http-endpoint.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return plainHttpEndpointRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPlainHttpEndpointReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("infra/web.tf", [
      "resource \"aws_lb_listener\" \"http\" {",
      "  load_balancer_arn = aws_lb.web.arn",
      "  port              = 80",
      "  protocol          = \"HTTP\"",
      "  default_action {",
      "    type             = \"forward\"",
      "    target_group_arn = aws_lb_target_group.web.arn",
      "  }",
      "}",
      "resource \"aws_cloudfront_distribution\" \"web\" {",
      "  default_cache_behavior {",
      "    viewer_protocol_policy = \"allow-all\"",
      "  }",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Endpoint serves plain HTTP");
  assert.deepEqual(finding?.lines, [4, 12]);
  assert.equal(
    finding?.message,
    "Lines 4, 12 let a load balancer listener and a CloudFront distribution serve plain HTTP without redirecting it to HTTPS, so anyone on the network path, such as a public Wi-Fi network, can read and change pages, session cookies, and credentials."
  );
}

export function testPlainHttpEndpointReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["infra/cdn.yaml", ["        DefaultCacheBehavior:", "          ViewerProtocolPolicy: allow-all"]],
    ["infra/stack.ts", ["  viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,"]],
    ["infra/app.tf", ["resource \"azurerm_linux_web_app\" \"app\" {", "  https_only = false", "}"]],
    ["infra/storage.tf", ["  https_traffic_only_enabled = false"]],
    ["infra/azuredeploy.json", ["\"properties\": {", "  \"httpsOnly\": false", "}"]],
    ["app.yaml", ["handlers:", "- url: /.*", "  script: auto", "  secure: optional"]],
    ["k8s/ingress.yaml", ["  annotations:", "    nginx.ingress.kubernetes.io/ssl-redirect: \"false\""]],
    ["infra/listener.yaml", ["  Listener:", "    Type: AWS::ElasticLoadBalancingV2::Listener", "    Properties:", "      Port: 80", "      Protocol: HTTP", "      DefaultActions:", "        - Type: forward"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPlainHttpEndpointSkipsRedirectsAndHttps(): void {
  const cases: Array<[string, string[]]> = [
    // Listeners that redirect to HTTPS, and HTTPS listeners.
    [
      "infra/web.tf",
      ["resource \"aws_lb_listener\" \"http\" {", "  port     = 80", "  protocol = \"HTTP\"", "  default_action {", "    type = \"redirect\"", "    redirect {", "      port        = \"443\"", "      protocol    = \"HTTPS\"", "      status_code = \"HTTP_301\"", "    }", "  }", "}"]
    ],
    ["infra/web.tf", ["resource \"aws_lb_listener\" \"https\" {", "  port     = 443", "  protocol = \"HTTPS\"", "}"]],
    ["infra/listener.yaml", ["    Type: AWS::ElasticLoadBalancingV2::Listener", "    Properties:", "      Protocol: HTTP", "      DefaultActions:", "        - Type: redirect", "          RedirectConfig:", "            Protocol: HTTPS"]],
    // Edits to an existing listener, whose header is not in the change.
    ["infra/web.tf", ["  protocol = \"HTTP\""]],
    // HTTPS settings and other protocols.
    ["infra/cdn.tf", ["    viewer_protocol_policy = \"redirect-to-https\""]],
    ["infra/app.tf", ["  https_only = true"]],
    ["app.yaml", ["  secure: always"]],
    ["k8s/ingress.yaml", ["    nginx.ingress.kubernetes.io/ssl-redirect: \"true\""]],
    ["infra/tg.tf", ["resource \"aws_lb_target_group\" \"web\" {", "  protocol = \"HTTP\"", "}"]],
    // The CDK's own enum, and a module's listener that its caller turns on.
    ["awscloudfront/ViewerProtocolPolicy.go", ["\tViewerProtocolPolicy_ALLOW_ALL ViewerProtocolPolicy = \"ALLOW_ALL\""]],
    ["awscloudfront/main.go", ["\t\t\t\"ALLOW_ALL\": ViewerProtocolPolicy_ALLOW_ALL,"]],
    ["main.tf", ["resource \"aws_lb_listener\" \"http_forward\" {", "  count    = var.http_enabled && var.http_redirect != true ? 1 : 0", "  protocol = \"HTTP\"", "}"]],
    // Descriptions, examples, and documentation.
    ["infra/variables.tf", ["  description = \"Use allow-all for viewer_protocol_policy = \\\"allow-all\\\"\""]],
    ["examples/complete/main.tf", ["    viewer_protocol_policy = \"allow-all\""]],
    ["docs/cdn.md", ["    viewer_protocol_policy = \"allow-all\""]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPlainHttpEndpointSkipsTestsAndCanBeDisabled(): void {
  const lines = ["    viewer_protocol_policy = \"allow-all\""];
  assert.deepEqual(findings([added("test/fixtures/cdn.tf", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { plainHttpEndpoint: { enabled: false } } });
  assert.deepEqual(findings([added("infra/cdn.tf", lines)], config), []);
}
