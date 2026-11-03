import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { openAccessRule } from "../../src/rules/open-access.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return openAccessRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testOpenAccessReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("firestore.rules", [
      "rules_version = '2';",
      "service cloud.firestore {",
      "  match /databases/{database}/documents {",
      "    match /{document=**} {",
      "      allow read, write: if true;",
      "    }",
      "  }",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Access control turned off");
  assert.deepEqual(finding?.lines, [5]);
  assert.equal(finding?.message, "Line 5 lets anyone read or write the database, so anyone who can reach the service can use it without signing in.");
}

export function testOpenAccessReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/java/app/SecurityConfig.java", ["http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());"]],
    ["src/main/java/app/SecurityConfig.java", ["    .requestMatchers(\"/**\").permitAll()"]],
    ["src/main/kotlin/app/SecurityConfig.kt", ["web.ignoring().anyRequest()"]],
    ["project/settings.py", ["REST_FRAMEWORK = {", "    'DEFAULT_PERMISSION_CLASSES': [", "        'rest_framework.permissions.AllowAny',", "    ],", "}"]],
    ["app/config.py", ["app.config['LOGIN_DISABLED'] = True"]],
    ["app/controllers/application_controller.rb", ["  skip_before_action :authenticate_user!"]],
    ["Controllers/OrdersController.cs", ["[AllowAnonymous]", "[ApiController]", "public class OrdersController : ControllerBase"]],
    ["Program.cs", ["app.MapControllers().AllowAnonymous();"]],
    ["routes/api.php", ["Route::prefix('admin')->withoutMiddleware(['auth'])->group(function () {"]],
    ["storage.rules", ["    allow write;"]],
    ["database.rules.json", ["{ \"rules\": { \".read\": true, \".write\": true } }"]],
    ["supabase/migrations/20260101_orders.sql", ["create policy \"anyone can update\" on orders for update using (true);"]],
    ["supabase/migrations/20260101_orders.sql", ["alter table orders disable row level security;"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testOpenAccessSkipsScopedAccess(): void {
  const cases: Array<[string, string[]]> = [
    // Public routes named one by one, and the default of requiring authentication.
    ["src/main/java/app/SecurityConfig.java", ["    .requestMatchers(\"/login\", \"/health\").permitAll()", "    .anyRequest().authenticated()"]],
    ["project/settings.py", ["REST_FRAMEWORK = {", "    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],", "}"]],
    // AllowAny on one view, away from the default setting.
    ["api/views.py", ["@permission_classes([AllowAny])", "def health(request):", "    return Response('ok')"]],
    ["app/controllers/pages_controller.rb", ["  skip_before_action :authenticate_user!"]],
    ["app/controllers/application_controller.rb", ["  skip_before_action :authenticate_user!, only: [:health]"]],
    ["Controllers/OrdersController.cs", ["[Authorize]", "public class OrdersController : ControllerBase", "{", "    [AllowAnonymous]", "    public IActionResult Index() => Ok();"]],
    // Rules that check who is asking, and public reads with a condition.
    ["firestore.rules", ["      allow read: if resource.data.public == true;", "      allow write: if request.auth != null && request.auth.uid == userId;"]],
    ["supabase/migrations/20260101_posts.sql", ["create policy \"public read\" on posts for select using (true);", "create policy \"own rows\" on posts for update using (auth.uid() = user_id);"]],
    // Python classes with the same name, development settings, and comments.
    ["api/router.py", ["    auth=[BearerTokenAuth(), AllowAnonymous()],"]],
    ["project/settings/dev.py", ["LOGIN_DISABLED = True"]],
    ["src/main/java/app/SecurityConfig.java", ["// http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testOpenAccessSkipsTestsAndCanBeDisabled(): void {
  const line = "http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());";
  assert.deepEqual(findings([added("src/test/java/app/SecurityConfigTest.java", [line]), added("fixtures/SecurityConfig.java", [line]), added("docs/security.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { openAccess: { enabled: false } } });
  assert.deepEqual(findings([added("src/main/java/app/SecurityConfig.java", [line])], config), []);
}
