import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { appConfigSecretRule } from "../../src/rules/app-config-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return appConfigSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testAppConfigSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/resources/application.properties", [
      "spring.datasource.url=jdbc:postgresql://db.internal:5432/orders",
      "spring.datasource.username=orders",
      "spring.datasource.password=Tr0ub4dor-staging"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Password written into the app's configuration");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 writes `spring.datasource.password` into the app's configuration in plain text, so the value is committed to the repository, where anyone who can read it, a fork, or its history can use it, and every environment that reads this file shares it."
  );
  assert.doesNotMatch(finding?.message ?? "", /Tr0ub4dor/);
}

export function testAppConfigSecretReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/resources/application.yml", ["spring:", "  mail:", "    password: Tr0ub4dor-staging"]],
    ["src/main/resources/application-prod.yml", ["app:", "  stripe:", "    api-key: Tr0ub4dor-staging"]],
    ["Api/appsettings.json", ["{", "  \"ConnectionStrings\": {", "    \"DefaultConnection\": \"Server=db.internal;Database=orders;User Id=orders;Password=Tr0ub4dor-staging;\"", "  }", "}"]],
    ["Api/appsettings.Production.json", ["{", "  \"Smtp\": {", "    \"Password\": \"Tr0ub4dor-staging\"", "  }", "}"]],
    ["Web/Web.config", ["<appSettings>", "  <add key=\"PaymentApiKey\" value=\"Tr0ub4dor-staging\" />", "</appSettings>"]],
    ["shop/settings.py", ["DATABASES = {", "    \"default\": {", "        \"ENGINE\": \"django.db.backends.postgresql\",", "        \"PASSWORD\": \"Tr0ub4dor-staging\",", "    }", "}"]],
    ["shop/settings/production.py", ["EMAIL_HOST_PASSWORD = os.environ.get(\"EMAIL_HOST_PASSWORD\", \"Tr0ub4dor-staging\")"]],
    ["config/database.yml", ["development:", "  password:", "production:", "  adapter: postgresql", "  password: Tr0ub4dor-staging"]],
    ["config/database.php", ["        'pgsql' => [", "            'password' => env('DB_PASSWORD', 'Tr0ub4dor-staging'),"]],
    ["config/production.json", ["{", "  \"db\": {", "    \"password\": \"Tr0ub4dor-staging\"", "  }", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testAppConfigSecretSkipsReferencesAndPlaceholders(): void {
  const cases: Array<[string, string[]]> = [
    // Placeholders filled from the environment, encrypted values, and secret stores.
    ["src/main/resources/application.properties", ["spring.datasource.password=${DB_PASSWORD}"]],
    ["src/main/resources/application.properties", ["spring.datasource.password=ENC(Xk9vQ2pV1+Yl0Hn8Q==)"]],
    ["src/main/resources/application.yml", ["spring:", "  datasource:", "    password: '{cipher}AQB7f0d2c1'"]],
    ["Api/appsettings.json", ["{", "  \"ConnectionStrings\": {", "    \"DefaultConnection\": \"Server=db.internal;Database=orders;Trusted_Connection=True;\"", "  }", "}"]],
    ["shop/settings.py", ["DATABASES = {\"default\": {\"PASSWORD\": os.environ[\"DB_PASSWORD\"]}}"]],
    ["shop/settings.py", ["EMAIL_HOST_PASSWORD = os.environ.get(\"EMAIL_HOST_PASSWORD\", \"\")"]],
    ["config/database.yml", ["production:", "  password: <%= ENV[\"DATABASE_PASSWORD\"] %>"]],
    ["config/database.php", ["            'password' => env('DB_PASSWORD', ''),"]],
    // Placeholders and local defaults, and keys that are not secrets.
    ["src/main/resources/application.properties", ["spring.datasource.password=changeme"]],
    ["config/database.php", ["            'password' => env('DB_PASSWORD', 'secret'),"]],
    ["src/main/resources/application.properties", ["spring.datasource.username=orders", "server.ssl.key-store-type=PKCS12"]],
    // Empty values with a comment, module paths, instructions, and values that repeat their name.
    ["src/main/resources/application.yml", ["spring:", "  redis:", "    password: # empty by default"]],
    ["shop/settings.py", ["PUSH_CREDENTIALS = \"aggregator.utils.push_credentials\""]],
    ["src/main/resources/application-prod.yml", ["oss:", "  secretKey: 填写你的SecretKey"]],
    ["src/main/resources/application.yml", ["security:", "  client-secret: shop-client-secret", "  token: \"token\""]],
    // Development and test sections and profiles, Django's SECRET_KEY, and other files.
    ["config/database.yml", ["development:", "  password: Tr0ub4dor-staging", "test:", "  password: Tr0ub4dor-staging"]],
    ["src/main/resources/application-dev.properties", ["spring.datasource.password=Tr0ub4dor-staging"]],
    ["shop/settings.py", ["SECRET_KEY = \"Tr0ub4dor-staging-key\""]],
    ["config/custom-environment-variables.json", ["{", "  \"db\": { \"password\": \"DB_PASSWORD\" }", "}"]],
    ["src/test/resources/application.properties", ["spring.datasource.password=Tr0ub4dor-staging"]],
    ["docs/configuration.md", ["spring.datasource.password=Tr0ub4dor-staging"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testAppConfigSecretFindsValuesBeforeRedaction(): void {
  // Redaction rewrites `password=...`, so the value is read first.
  const files = prepareChangedFiles([added("src/main/resources/application.properties", ["spring.datasource.password=Tr0ub4dor-staging"])], defaultConfig);
  const [finding, ...rest] = analyzePullRequest(files, defaultConfig).findings.filter(({ ruleId }) => ruleId === "app-config-secret");

  assert.doesNotMatch(files[0]?.patch ?? "", /Tr0ub4dor/);
  assert.equal(rest.length, 0);
  assert.deepEqual(finding?.lines, [1]);
}

export function testAppConfigSecretSkipsTestsAndCanBeDisabled(): void {
  const lines = ["spring.datasource.password=Tr0ub4dor-staging"];
  assert.deepEqual(findings([added("examples/shop/src/main/resources/application.properties", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { appConfigSecret: { enabled: false } } });
  assert.deepEqual(findings([added("src/main/resources/application.properties", lines)], config), []);
}
