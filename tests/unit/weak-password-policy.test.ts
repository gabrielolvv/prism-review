import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakPasswordPolicyRule } from "../../src/rules/weak-password-policy.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakPasswordPolicyRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakPasswordPolicyReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("project/settings.py", [
      "AUTH_PASSWORD_VALIDATORS = []",
      "ACCOUNT_PASSWORD_MIN_LENGTH = 6"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Weak password policy");
  assert.deepEqual(finding?.lines, [1, 2]);
  assert.equal(
    finding?.message,
    "Lines 1, 2 allow passwords shorter than 8 characters, and turn Django's password validators off, which leaves accounts open to guessing and to the lists of leaked passwords attackers try first."
  );
}

export function testWeakPasswordPolicyReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["project/settings.py", ["AUTH_PASSWORD_VALIDATORS = [", "    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},", "]"]],
    ["app/schemas.py", ["    password: str = Field(..., min_length=6)"]],
    ["app/forms.py", ["    password = PasswordField('Password', validators=[DataRequired(), Length(min=4)])"]],
    ["config/initializers/devise.rb", ["  config.password_length = 6..128"]],
    ["app/models/user.rb", ["  validates :password, presence: true, length: { minimum: 6 }"]],
    ["Startup.cs", ["    options.Password.RequiredLength = 6;"]],
    ["src/auth/schema.ts", ["  password: z.string().min(6),"]],
    ["src/auth/validation.js", ["  password: Joi.string().min(4).required(),"]],
    ["src/models/user.js", ["  password: { type: String, required: true, minlength: 6 },"]],
    ["src/routes/register.js", ["  body('password').isLength({ min: 5 }),"]],
    ["src/auth/register.dto.ts", ["  @MinLength(6)", "  password: string;"]],
    ["src/main/java/app/RegisterRequest.java", ["    @Size(min = 6, max = 64)", "    private String password;"]],
    ["app/Http/Controllers/Auth/RegisterController.php", ["            'password' => 'required|string|min:6|confirmed',"]],
    ["infra/iam.tf", ["  minimum_password_length = 6"]],
    ["infra/cognito.tf", ["  password_policy {", "    minimum_length    = 6", "    require_lowercase = true", "  }"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakPasswordPolicySkipsStrongPolicies(): void {
  const cases: Array<[string, string[]]> = [
    ["project/settings.py", ["    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},"]],
    ["config/initializers/devise.rb", ["  config.password_length = 12..128"]],
    ["src/auth/schema.ts", ["  password: z.string().min(12),"]],
    // A login form only requires a value, and the current password a change form asks for.
    ["src/auth/login.ts", ["  password: z.string().min(1, 'Required'),"]],
    ["src/auth/change.ts", ["  currentPassword: z.string().min(6),"]],
    // Other fields, and lengths that are not about passwords.
    ["src/auth/schema.ts", ["  username: z.string().min(3),"]],
    ["infra/cognito.tf", ["  username_configuration {", "    minimum_length = 3", "  }"]],
    ["src/main/java/app/RegisterRequest.java", ["    @Size(min = 3)", "    private String username;"]],
    // Django's defaults, development settings, and comments.
    ["django/conf/global_settings.py", ["AUTH_PASSWORD_VALIDATORS = []"]],
    ["project/settings/dev.py", ["AUTH_PASSWORD_VALIDATORS = []"]],
    ["config/initializers/devise.rb", ["  # config.password_length = 6..128"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakPasswordPolicySkipsTestsAndCanBeDisabled(): void {
  const line = "  password: z.string().min(6),";
  assert.deepEqual(findings([added("src/auth/schema.test.ts", [line]), added("fixtures/schema.ts", [line]), added("docs/auth.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { weakPasswordPolicy: { enabled: false } } });
  assert.deepEqual(findings([added("src/auth/schema.ts", [line])], config), []);
}
