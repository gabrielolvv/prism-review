import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { debugEndpointRule } from "../../src/rules/debug-endpoint.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return debugEndpointRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testDebugEndpointReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/resources/application.yml", [
      "management:",
      "  endpoints:",
      "    web:",
      "      exposure:",
      '        include: "*"',
      "  endpoint:",
      "    env:",
      "      show-values: ALWAYS"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Debug endpoint exposed");
  assert.deepEqual(finding?.lines, [5, 8]);
  assert.equal(
    finding?.message,
    "Lines 5, 8 expose Spring Boot Actuator endpoints that show settings, memory, or let a caller shut the app down, which can give whoever reaches them secrets from settings or memory, the app's internals, or a way to run code."
  );
}

export function testDebugEndpointReadsEachKind(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["src/main/resources/application.properties", ["management.endpoints.web.exposure.include=health,info,env,heapdump"], "high"],
    ["src/main/resources/application-prod.properties", ["management.security.enabled=false"], "high"],
    ["src/main/resources/application.properties", ["management.endpoint.shutdown.enabled=true"], "high"],
    ["package.json", ['    "start": "node --inspect=0.0.0.0:9229 server.js"'], "high"],
    ["Dockerfile", ['CMD ["node", "--inspect=0.0.0.0", "dist/main.js"]'], "high"],
    ["cmd/server/main.go", ["import (", '\t_ "net/http/pprof"', ")"], "warning"],
    ["src/Program.cs", ["var app = builder.Build();", "app.UseDeveloperExceptionPage();"], "warning"],
    ["src/app.js", ["const errorhandler = require('errorhandler');", "app.use(errorhandler());"], "warning"],
    ["src/server.ts", ["const server = new ApolloServer({", "  schema,", "  introspection: true", "});"], "warning"],
    ["public/info.php", ["<?php phpinfo(); ?>"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testDebugEndpointSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/resources/application.properties", ["management.endpoints.web.exposure.include=health,info,prometheus"]],
    ["src/main/resources/application.yml", ["management:", "  endpoints:", "    web:", "      exposure:", "        include: health,info"]],
    // `include:` outside `exposure:` is some other setting.
    ["src/main/resources/application.yml", ["spring:", "  profiles:", '    include: "*"']],
    ["package.json", ['    "debug": "node --inspect=127.0.0.1:9229 server.js"']],
    ["src/Program.cs", ["if (app.Environment.IsDevelopment())", "{", "    app.UseDeveloperExceptionPage();", "}"]],
    ["src/app.js", ["if (process.env.NODE_ENV === 'development') {", "  app.use(errorhandler());", "}", "const errorhandler = require('errorhandler');"]],
    // An app's own handler with the same name.
    ["src/app.js", ["const errorHandler = require('./middleware/error');", "app.use(errorHandler());"]],
    // Introspection left to a plugin, and a setting outside a GraphQL server.
    [
      "src/graphql.js",
      ["const apollo = new ApolloServer({", "  introspection: true,", "  plugins: [IntrospectionControlPlugin(publicIntrospection)],", "});"]
    ],
    ["src/options.js", ["const options = { introspection: true };"]],
    ["src/Admin.php", ["$status->phpinfo();", "echo 'phpinfo() is disabled';", "function phpinfo() {}"]],
    // Development settings, benchmarks, and comments.
    ["src/main/resources/application-dev.yml", ["management.endpoints.web.exposure.include: '*'"]],
    ["benchmark/server/main.go", ['import _ "net/http/pprof"']],
    ["cmd/server/main.go", ['// import _ "net/http/pprof"']]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testDebugEndpointSkipsTestsAndCanBeDisabled(): void {
  const line = 'import _ "net/http/pprof"';
  assert.deepEqual(findings([added("server/main_test.go", [line]), added("testdata/main.go", [line]), added("docs/profiling.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { debugEndpoint: { enabled: false } } });
  assert.deepEqual(findings([added("cmd/server/main.go", [line])], config), []);
}
