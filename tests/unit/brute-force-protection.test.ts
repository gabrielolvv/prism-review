import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { bruteForceProtectionRule } from "../../src/rules/brute-force-protection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return bruteForceProtectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testBruteForceProtectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("project/settings.py", [
      "AXES_ENABLED = False",
      "AXES_COOLOFF_TIME = 1",
      "RATELIMIT_ENABLE = False"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Brute-force protection off");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 turn off or loosen the limit on failed logins, so an attacker can try password after password, from leaked lists or by guessing, against an account until one works."
  );
}

export function testBruteForceProtectionReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["project/settings.py", ["AXES_FAILURE_LIMIT = 1000"]],
    ["app/config.py", ["RATELIMIT_ENABLED = False"]],
    ["app/__init__.py", ["limiter.enabled = False"]],
    ["config/initializers/rack_attack.rb", ["Rack::Attack.enabled = false"]],
    ["config/initializers/devise.rb", ["  config.lock_strategy = :none"]],
    ["config/initializers/devise.rb", ["  config.maximum_attempts = 500"]],
    ["Areas/Identity/Pages/Account/Login.cshtml.cs", ["var result = await _signInManager.PasswordSignInAsync(Input.Email, Input.Password, Input.RememberMe, lockoutOnFailure: false);"]],
    ["Program.cs", ["    options.Lockout.MaxFailedAccessAttempts = 1000;"]],
    ["src/app.js", ["const limiter = rateLimit({ windowMs: 60_000, max: 5, skip: () => true });"]],
    ["src/auth/auth.controller.ts", ["@SkipThrottle()", "@Controller('auth')", "export class AuthController {}"]],
    ["realm-export.json", ["  \"bruteForceProtected\": false,"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testBruteForceProtectionSkipsActiveLimits(): void {
  const cases: Array<[string, string[]]> = [
    ["project/settings.py", ["AXES_ENABLED = True", "AXES_FAILURE_LIMIT = 5"]],
    ["config/initializers/devise.rb", ["  config.lock_strategy = :failed_attempts", "  config.maximum_attempts = 10", "  # config.maximum_attempts = 1000"]],
    ["Areas/Identity/Pages/Account/Login.cshtml.cs", ["var result = await _signInManager.PasswordSignInAsync(Input.Email, Input.Password, Input.RememberMe, lockoutOnFailure: true);"]],
    // A limiter that skips only trusted requests, and skip outside a rate limiter.
    ["src/app.js", ["const limiter = rateLimit({ max: 5, skip: (req) => req.ip === '127.0.0.1' });"]],
    ["src/list.js", ["const page = paginate({ skip: () => true });"]],
    // Throttling skipped on a controller that is not about logins.
    ["src/health/health.controller.ts", ["@SkipThrottle()", "export class HealthController {}"]],
    // Libraries reading the setting, test settings, and comments.
    ["axes/conf.py", ["settings.AXES_ENABLED = getattr(settings, 'AXES_ENABLED', True)"]],
    ["project/settings/test.py", ["AXES_ENABLED = False"]],
    ["project/settings.py", ["# AXES_ENABLED = False"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testBruteForceProtectionSkipsTestsAndCanBeDisabled(): void {
  const line = "Rack::Attack.enabled = false";
  assert.deepEqual(findings([added("spec/support/rack_attack.rb", [line]), added("fixtures/rack_attack.rb", [line]), added("docs/limits.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { bruteForceProtection: { enabled: false } } });
  assert.deepEqual(findings([added("config/initializers/rack_attack.rb", [line])], config), []);
}
