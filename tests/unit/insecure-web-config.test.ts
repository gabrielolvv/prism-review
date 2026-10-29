import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { insecureWebConfigRule } from "../../src/rules/insecure-web-config.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return insecureWebConfigRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testInsecureWebConfigReportsCorsWithCredentials(): void {
  const express = findings([added("src/server.ts", ["app.use(cors({", "  origin: true,", "  credentials: true,", "}));"])]);
  assert.equal(express[0]?.severity, "high");
  assert.equal(express[0]?.title, "CORS allows every origin with credentials");
  assert.deepEqual(express[0]?.lines, [2, 3]);

  const cases: Array<[string, string[]]> = [
    ["src/io.ts", ['const io = new Server(http, { cors: cors({ origin: true, credentials: true }) });']],
    ["app/settings.py", ["CORS_ALLOW_ALL_ORIGINS = True", "SECRET_KEY = env('SECRET_KEY')", ...Array(20).fill("X = 1"), "CORS_ALLOW_CREDENTIALS = True"]],
    ["app/__init__.py", ['CORS(app, origins="*", supports_credentials=True)']],
    ["src/main/java/WebConfig.java", ['registry.addMapping("/**").allowedOriginPatterns("*").allowCredentials(true);']],
    ["Program.cs", ["policy.SetIsOriginAllowed(_ => true).AllowCredentials();"]],
    ["src/cors.js", ['res.setHeader("Access-Control-Allow-Origin", req.headers.origin);', 'res.setHeader("Access-Control-Allow-Credentials", "true");']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)])[0]?.severity, "high", path);
  }

  // Credentials already set in an unchanged line still count when the pull request opens the origin.
  const context: ChangedFile = { path: "src/app.ts", status: "modified", additions: 1, deletions: 1, patch: "@@ -1,3 +1,3 @@\n cors({\n-  origin: [\"https://app.example.com\"],\n+  origin: \"*\",\n   credentials: true," };
  assert.deepEqual(findings([context])[0]?.lines, [2]);
}

export function testInsecureWebConfigReportsCookiesAndDebug(): void {
  const [finding] = findings([
    added("src/session.ts", ['res.cookie("sid", token, { httpOnly: false });', "app.use(session({ cookie: { httpOnly: false } }));"])
  ]);
  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [1, 2]);

  assert.deepEqual(findings([added("mysite/settings.py", ["DEBUG = True", "SESSION_COOKIE_SECURE = False"])])[0]?.lines, [1, 2]);
  assert.deepEqual(findings([added("config/settings/production.py", ["DEBUG = True"])])[0]?.lines, [1]);
  assert.deepEqual(findings([added("app.py", ['app.run(host="0.0.0.0", debug=True)'])])[0]?.lines, [1]);
  assert.deepEqual(findings([added("config/environments/production.rb", ["  config.consider_all_requests_local = true"])])[0]?.lines, [1]);
  assert.match(
    findings([added("app.py", ["app.run(debug=True)"])])[0]?.message ?? "",
    /^Line 1 changes web configuration in a way that turns on a debug mode/
  );
}

export function testInsecureWebConfigSkipsSafeSettings(): void {
  const safe = [
    // Every origin without credentials is a public API; credentials with a list of origins are fine.
    'app.use(cors({ origin: "*" }));',
    'app.use(cors({ origin: ["https://app.example.com"], credentials: true }));',
    // `secure: false` outside a cookie is an SMTP or proxy option.
    "const transport = nodemailer.createTransport({ host, port: 587, secure: false });",
    'res.cookie("sid", token, { httpOnly: true, secure: true });',
    "app.run(debug=False)",
    "// app.run(debug=True)"
  ];
  assert.deepEqual(findings([added("src/server.ts", safe)]), []);

  // Debug settings meant for development, and production files for other frameworks.
  assert.deepEqual(findings([added("mysite/settings/dev.py", ["DEBUG = True"])]), []);
  assert.deepEqual(findings([added("mysite/settings_local.py", ["DEBUG = True"])]), []);
  assert.deepEqual(findings([added("config/environments/development.rb", ["config.consider_all_requests_local = true"])]), []);

  const lines = ["CORS_ALLOW_ALL_ORIGINS = True", "CORS_ALLOW_CREDENTIALS = True"];
  assert.deepEqual(findings([added("docs/cors.md", lines)]), []);
  assert.deepEqual(findings([added("tests/test_settings.py", lines)]), []);
  assert.deepEqual(findings([added("app/settings.py", lines)], prismConfigSchema.parse({ rules: { insecureWebConfig: { enabled: false } } })), []);
}
