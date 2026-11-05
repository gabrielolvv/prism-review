import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { devConsoleExposedRule } from "../../src/rules/dev-console-exposed.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return devConsoleExposedRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testDevConsoleExposedReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/resources/application.properties", [
      "spring.datasource.url=jdbc:h2:mem:app",
      "spring.h2.console.enabled=true",
      "spring.h2.console.settings.web-allow-others=true"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Developer console turned on");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 turn on the H2 database console and the H2 database console open to other machines, which show SQL queries, settings, and secrets to whoever opens them, and some of them run SQL or code on the server."
  );
}

export function testDevConsoleExposedWarnsForTheH2ConsoleAlone(): void {
  const [finding] = findings([added("src/main/resources/application.yml", ["spring:", "  h2:", "    console:", "      enabled: true", "      path: /h2"])]);

  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [4]);
  assert.equal(
    finding?.message,
    "Line 4 turns on the H2 database console, which shows SQL queries, settings, and secrets to whoever opens it, and some of them run SQL or code on the server."
  );
}

export function testDevConsoleExposedReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/resources/application.yml", ["spring:", "  h2:", "    console:", "      enabled: true", "      settings:", "        web-allow-others: true"]],
    ["src/main/resources/application-prod.properties", ["spring.devtools.remote.secret=s3cr3t"]],
    ["src/main/resources/application.yaml", ["spring:", "  devtools:", "    remote:", "      secret: ${DEVTOOLS_SECRET}"]],
    ["config/environments/production.rb", ["  config.web_console.development_only = false"]],
    ["src/main/resources/application.yml", ["spring:", "  config:", "    activate:", "      on-profile: dev", "---", "spring:", "  h2:", "    console:", "      enabled: true"]],
    ["config/application.rb", ["    config.web_console.permissions = '0.0.0.0/0'"]],
    ["config/environments/staging.rb", ["  config.web_console.whitelisted_ips = ['::/0']"]],
    ["project/settings/production.py", ["DEBUG_TOOLBAR_CONFIG = {", "    'SHOW_TOOLBAR_CALLBACK': lambda request: True,", "}"]],
    ["app/__init__.py", ["app.config['DEBUG_TB_ENABLED'] = True"]],
    ["config.py", ["    DEBUG_TB_ENABLED = True"]],
    [".env.production", ["APP_ENV=production", "APP_DEBUG=true"]],
    [".env.staging", ["DEBUGBAR_ENABLED=true"]],
    ["config/app.php", ["    'debug' => true,"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testDevConsoleExposedSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Turned off, read from the environment, or another `enabled` key.
    ["src/main/resources/application.properties", ["spring.h2.console.enabled=false", "spring.h2.console.settings.web-allow-others=false"]],
    ["src/main/resources/application.yml", ["management:", "  endpoint:", "    health:", "      enabled: true"]],
    ["src/main/resources/application.yml", ["logging:", "  console:", "    enabled: true"]],
    ["config/app.php", ["    'debug' => (bool) env('APP_DEBUG', false),"]],
    [".env.production", ["APP_DEBUG=false"]],
    ["config/environments/production.rb", ["  config.web_console.permissions = '10.0.0.0/8'"]],
    ["project/settings/production.py", ["DEBUG_TOOLBAR_CONFIG = {'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG}"]],
    // Other `.env` files are for development.
    [".env", ["APP_DEBUG=true"]],
    [".env.example", ["APP_DEBUG=true"]],
    // Only in debug or development mode.
    ["project/settings.py", ["if DEBUG_TOOLBAR:", "    DEBUG_TOOLBAR_CONFIG = {", "        'SHOW_TOOLBAR_CALLBACK': lambda request: True,", "    }"]],
    ["config/application.rb", ["    if Rails.env.development?", "      config.web_console.permissions = '0.0.0.0/0'", "    end"]],
    ["src/main/resources/application.yml", ["spring:", "  datasource:", "    url: jdbc:postgresql://db/app", "---", "spring:", "  config:", "    activate:", "      on-profile: dev", "  h2:", "    console:", "      enabled: true"]],
    ["src/main/resources/application.properties", ["#---", "spring.h2.console.enabled=true", "spring.config.activate.on-profile=local"]],
    // A gem's own warning that shows the setting.
    ["lib/web_console/railtie.rb", ["        logger.info <<~END.squish", "          config.web_console.development_only = false", "        END"]],
    // Development settings, comments, and documentation.
    ["src/main/resources/application-dev.properties", ["spring.h2.console.enabled=true", "spring.h2.console.settings.web-allow-others=true"]],
    ["config/environments/development.rb", ["  config.web_console.permissions = '0.0.0.0/0'"]],
    ["project/settings/local.py", ["DEBUG_TOOLBAR_CONFIG = {'SHOW_TOOLBAR_CALLBACK': lambda request: True}"]],
    ["src/main/resources/application.properties", ["# spring.h2.console.enabled=true"]],
    ["docs/h2.md", ["spring.h2.console.enabled=true"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testDevConsoleExposedSkipsTestsAndCanBeDisabled(): void {
  const lines = ["spring.h2.console.enabled=true"];
  assert.deepEqual(findings([added("src/test/resources/application.properties", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { devConsoleExposed: { enabled: false } } });
  assert.deepEqual(findings([added("src/main/resources/application.properties", lines)], config), []);
}
