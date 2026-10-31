import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { securityHeadersRule } from "../../src/rules/security-headers.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return securityHeadersRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSecurityHeadersReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/app.js", [
      "app.use(helmet({",
      "  contentSecurityPolicy: false,",
      "  frameguard: false,",
      "  hsts: false",
      "}));"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Security header weakened");
  assert.deepEqual(finding?.lines, [2, 3, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 3, 4 set a Content-Security-Policy that is off or lets inline or injected scripts run, and framing protection turned off, which allows clickjacking, and HTTPS enforcement or MIME type sniffing protection turned off, removing a layer that stops cross-site scripting, clickjacking, or downgrade attacks when other defenses fail."
  );
}

export function testSecurityHeadersReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/app.js", ["app.use(helmet.contentSecurityPolicy({ directives: { scriptSrc: [\"'self'\", \"'unsafe-eval'\"] } }));"]],
    ["src/server.ts", ["res.removeHeader('X-Frame-Options');"]],
    ["src/server.ts", ["res.setHeader('Content-Security-Policy', \"default-src 'self'; script-src 'self' 'unsafe-inline'\");"]],
    ["app/settings.py", ["SECURE_SSL_REDIRECT = False"]],
    ["app/settings.py", ["SECURE_HSTS_SECONDS = 0"]],
    ["app/settings.py", ["X_FRAME_OPTIONS = 'ALLOWALL'"]],
    ["app/views.py", ["@xframe_options_exempt", "def embed(request):", "    return render(request, 'embed.html')"]],
    ["app/settings.py", ["CSP_SCRIPT_SRC = (\"'self'\", \"'unsafe-inline'\")"]],
    ["app/__init__.py", ["Talisman(app, content_security_policy=None)"]],
    ["config/environments/production.rb", ["  config.force_ssl = false"]],
    ["config/initializers/csp.rb", ["  policy.script_src :self, :unsafe_inline"]],
    ["src/SecurityConfig.java", ["http.headers().frameOptions().disable();"]],
    ["src/SecurityConfig.java", ["http.headers(headers -> headers.frameOptions(frame -> frame.disable()));"]],
    ["src/SecurityConfig.kt", ["http.headers().httpStrictTransportSecurity().disable()"]],
    ["deploy/nginx.conf", ["add_header Content-Security-Policy \"default-src *; script-src * 'unsafe-inline'\";"]],
    ["templates/base.html", ["<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'self' 'unsafe-eval'\">"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSecurityHeadersReportsEveryKindWhenAllHeadersAreOff(): void {
  const [finding] = findings([added("src/SecurityConfig.java", ["http.headers(headers -> headers.disable());"])]);
  assert.match(finding?.message ?? "", /Content-Security-Policy.*framing.*HTTPS enforcement/);
}

export function testSecurityHeadersSkipsStrongSettings(): void {
  const cases: Array<[string, string[]]> = [
    ["src/app.js", ["app.use(helmet());", "app.use(helmet({ crossOriginEmbedderPolicy: false }));"]],
    ["src/app.js", ["app.use(helmet.contentSecurityPolicy({ directives: { scriptSrc: [\"'self'\", `'nonce-${nonce}'`] } }));"]],
    ["src/server.ts", ["res.setHeader('Content-Security-Policy', \"default-src 'self'; style-src 'self' 'unsafe-inline'\");"]],
    ["src/server.ts", ["res.setHeader('X-Frame-Options', 'SAMEORIGIN');"]],
    ["app/settings.py", ["SECURE_SSL_REDIRECT = True", "SECURE_HSTS_SECONDS = 31536000", "X_FRAME_OPTIONS = 'DENY'"]],
    ["config/environments/production.rb", ["  config.force_ssl = true"]],
    ["src/SecurityConfig.java", ["http.headers().frameOptions().sameOrigin();"]],
    // Local settings, Django's defaults, docstrings, and comments.
    ["app/settings/local.py", ["SECURE_SSL_REDIRECT = False"]],
    ["config/environments/development.rb", ["  config.force_ssl = false"]],
    ["django/conf/global_settings.py", ["SECURE_HSTS_SECONDS = 0", "SECURE_SSL_REDIRECT = False"]],
    ["django/views/decorators/clickjacking.py", ['    """', "    Usage:", "", "    @xframe_options_exempt", "    def some_view(request):", '    """']],
    ["src/app.js", ["// app.use(helmet({ contentSecurityPolicy: false }));"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSecurityHeadersSkipsTestsAndCanBeDisabled(): void {
  const line = "app.use(helmet({ contentSecurityPolicy: false }));";
  assert.deepEqual(findings([added("test/app.test.js", [line]), added("fixtures/app.js", [line]), added("docs/security.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { securityHeaders: { enabled: false } } });
  assert.deepEqual(findings([added("src/app.js", [line])], config), []);
}
