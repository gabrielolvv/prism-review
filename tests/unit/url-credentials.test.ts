import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { urlCredentialsRule } from "../../src/rules/url-credentials.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";
import { redactSecrets } from "../../src/security/redact-secrets.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return urlCredentialsRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Built at run time, so this file does not hold the URLs it tests.
function url(scheme: string, user: string, password: string, host: string): string {
  return `${scheme}://${user}:${password}@${host}`;
}

export function testUrlCredentialsReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("docker-compose.prod.yml", [
      "services:",
      `  DATABASE_URL: "${url("postgres", "app", "Xk92mPq7vR", "prod-db.internal.acme.io:5432")}/app"`,
      `  REDIS_URL: ${url("redis", "", "f7Hk2LmQ9z", "cache.acme.io:6379")}/0`
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Password in a URL");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 add URLs with a password in them, such as a database connection string, so anyone who can read the repository can use those passwords. The passwords are redacted from this review."
  );
}

export function testUrlCredentialsReadsEachKindOfFile(): void {
  const cases: Array<[string, string]> = [
    ["src/db.ts", `const uri = "${url("mongodb+srv", "admin", "Zq8wT3nB1x", "cluster0.ab1cd.mongodb.net")}/shop";`],
    ["app/settings.py", `engine = create_engine("${url("postgresql", "report", "Vq3%40rT9w", "analytics.acme.io")}/warehouse")`],
    ["src/main/resources/application.properties", `spring.datasource.url=jdbc:${url("mysql", "root", "R00tPa55!", "10.0.4.12:3306")}/orders`],
    ["deploy/values.yaml", `amqpUrl: ${url("amqps", "svc", "H4ppyRabbit", "b-1234.mq.us-east-1.amazonaws.com:5671")}`],
    ["scripts/deploy.sh", `git clone ${url("https", "deploy", "a8Fh3kLq0Wz", "github.com")}/acme/app.git`]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testUrlCredentialsSkipsExamplesAndReferences(): void {
  const safe = [
    // Local development defaults and placeholders.
    `url: ${url("postgres", "postgres", "postgres", "localhost:5432")}/app`,
    `url: "${url("postgres", "user", "password", "host:5432")}/db"`,
    `url: "${url("amqp", "guest", "guest", "rabbitmq:5672")}/"`,
    `url: "${url("mongodb", "admin", "changeme", "mongo:27017")}"`,
    `url: "${url("https", "user", "pass", "example.com")}/path"`,
    `url: "${url("postgres", "app", "****", "db.acme.io")}/app"`,
    // Template syntax that fills in the password.
    `url: "${url("postgres", "${DB_USER}", "${DB_PASSWORD}", "${DB_HOST}")}/app"`,
    `url: "${url("postgres", "{{ .Values.user }}", "{{ .Values.password }}", "db")}/app"`,
    `url = f"${url("postgresql", "{user}", "{password}", "{host}")}/{db}"`,
    `url = "${url("mysql", "%s", "%s", "%s")}/%s" % (user, pw, host, db)`,
    `url = "${url("postgres", "app", "$DB_PASSWORD", "db.acme.io")}/app"`,
    // Documentation examples.
    `engine = create_engine("${url("oracle+cx_oracle", "scott", "tiger", "xe")}")`,
    `engine = create_engine("${url("mssql+pyodbc", "u", "p", "dsn")}")`,
    // Comments, and URLs without a password.
    `// ${url("postgres", "app", "Xk92mPq7vR", "db.acme.io")}`,
    'remote = "https://github.com/acme/app.git"',
    'contact = "mailto:someone@acme.io"'
  ];

  assert.deepEqual(findings([added("src/config.ts", safe)]), []);
}

export function testUrlCredentialsSkipsTestsDocsAndCredentialFiles(): void {
  const line = `DATABASE_URL=${url("postgres", "app", "Xk92mPq7vR", "db.acme.io")}/app`;

  assert.deepEqual(
    findings([
      added("tests/db.test.ts", [line]),
      added("docs/setup.md", [line]),
      added("fixtures/app/config.yml", [line]),
      // credential-file reports URLs in environment files.
      added(".env.production", [line])
    ]),
    []
  );
}

export function testUrlCredentialsCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { urlCredentials: { enabled: false } } });

  assert.deepEqual(findings([added("src/db.ts", [`const uri = "${url("postgres", "app", "Xk92mPq7vR", "db.acme.io")}";`])], config), []);
}

export function testUrlCredentialsRedactsThePassword(): void {
  const line = `const uri = "${url("postgres", "app", "Xk92mPq7vR", "db.acme.io")}/app";`;
  const files = prepareChangedFiles([added("src/db.ts", [line])], defaultConfig);

  assert.ok(files[0]?.patch?.includes(`postgres://app:[REDACTED]@db.acme.io/app`));
  assert.deepEqual(findings(files)[0]?.lines, [1]);

  // Examples, and passwords on the allowlist, stay as written.
  const example = url("postgres", "postgres", "postgres", "localhost");
  assert.equal(redactSecrets(example), example);
  const allowed = url("postgres", "ci", "Ci-Only-Value", "db.acme.io");
  assert.equal(redactSecrets(allowed, { allowlist: [/^Ci-Only-/] }), allowed);
  const config = prismConfigSchema.parse({ security: { redaction: { allowlist: ["^Ci-Only-"] } } });
  assert.deepEqual(findings(prepareChangedFiles([added("src/db.ts", [allowed])], config), config), []);
  assert.deepEqual(findings([added("src/db.ts", [allowed])], config), []);
}
