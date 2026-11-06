import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { sessionIdInUrlRule } from "../../src/rules/session-id-in-url.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return sessionIdInUrlRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSessionIdInUrlReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/resources/application.properties", ["server.servlet.session.timeout=30m", "server.servlet.session.tracking-modes=cookie,url"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Session ID carried in URLs");
  assert.deepEqual(finding?.lines, [2]);
  assert.equal(
    finding?.message,
    "Line 2 lets Spring Boot carry the session ID in URLs, where it ends up in server and proxy logs, browser history, and the Referer header sent to other sites, so anyone who sees one of those can take over the session, and an attacker can send a link that fixes a victim's session to an ID they know."
  );
}

export function testSessionIdInUrlReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/resources/application.yml", ["server:", "  servlet:", "    session:", "      tracking-modes:", "        - url"]],
    ["src/main/resources/application.yml", ["      tracking-modes: url"]],
    ["src/main/webapp/WEB-INF/web.xml", ["<session-config>", "  <tracking-mode>URL</tracking-mode>", "</session-config>"]],
    ["src/main/java/com/acme/Init.java", ["context.setSessionTrackingModes(EnumSet.of(SessionTrackingMode.URL));"]],
    ["src/main/resources/shiro.ini", ["[main]", "sessionManager.sessionIdUrlRewritingEnabled = true"]],
    ["docker/php.ini", ["session.use_trans_sid = 1"]],
    ["public/index.php", ["ini_set('session.use_only_cookies', '0');"]],
    ["Web.config", ["<system.web>", "  <sessionState mode=\"InProc\" cookieless=\"UseUri\" />", "</system.web>"]],
    ["config/initializers/session_store.rb", ["Rails.application.config.session_store :cookie_store, key: \"_app_session\", cookie_only: false"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSessionIdInUrlSkipsCookieSessions(): void {
  const cases: Array<[string, string[]]> = [
    // Cookie tracking only.
    ["src/main/resources/application.properties", ["server.servlet.session.tracking-modes=cookie"]],
    ["src/main/resources/application.yml", ["      tracking-modes:", "        - cookie"]],
    ["src/main/webapp/WEB-INF/web.xml", ["  <tracking-mode>COOKIE</tracking-mode>"]],
    ["src/main/resources/shiro.ini", ["sessionManager.sessionIdUrlRewritingEnabled = false"]],
    ["docker/php.ini", ["session.use_trans_sid = 0", "session.use_only_cookies = 1"]],
    ["Web.config", ["  <sessionState mode=\"InProc\" cookieless=\"UseCookies\" />"]],
    ["config/initializers/session_store.rb", ["Rails.application.config.session_store :cookie_store, cookie_only: true"]],
    // A `- url` list item under another key, and comments.
    ["src/main/resources/application.yml", ["  endpoints:", "    - url"]],
    ["docker/php.ini", ["; session.use_trans_sid = 1"]],
    // Development settings and documentation.
    ["src/main/resources/application-dev.properties", ["server.servlet.session.tracking-modes=url"]],
    ["docs/sessions.md", ["server.servlet.session.tracking-modes=url"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSessionIdInUrlSkipsTestsAndCanBeDisabled(): void {
  const lines = ["server.servlet.session.tracking-modes=url"];
  assert.deepEqual(findings([added("src/test/resources/application.properties", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { sessionIdInUrl: { enabled: false } } });
  assert.deepEqual(findings([added("src/main/resources/application.properties", lines)], config), []);
}
