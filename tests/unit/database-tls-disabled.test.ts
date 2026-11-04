import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { databaseTlsDisabledRule } from "../../src/rules/database-tls-disabled.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return databaseTlsDisabledRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testDatabaseTlsDisabledReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/app.env", [
      "DATABASE_URL=postgres://app@db.acme.io:5432/app?sslmode=disable",
      "REPORTS_URL=postgresql://reports@reports.acme.io/reports?sslmode=require",
      "MONGO_URL=mongodb://app@mongo.acme.io/app?tlsAllowInvalidCertificates=true"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Database connection without TLS");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 connect to db.acme.io and mongo.acme.io without TLS or without checking the server's certificate, so the database password and every query and result cross the network where anyone on the path can read them or, by posing as the server, change them."
  );
}

export function testDatabaseTlsDisabledReadsEachDriver(): void {
  const cases: Array<[string, string[], string]> = [
    ["internal/db/db.go", ["\tdsn := \"host=db.acme.io port=5432 user=app dbname=app sslmode=disable\""], "without TLS"],
    ["src/main/resources/application.properties", ["spring.datasource.url=jdbc:mysql://mysql.acme.io:3306/app?useSSL=false&serverTimezone=UTC"], "without TLS"],
    ["src/main/resources/application.yml", ["    url: jdbc:sqlserver://sql.acme.io:1433;databaseName=app;encrypt=false"], "without TLS"],
    ["src/main/resources/application.yml", ["    url: jdbc:sqlserver://sql.acme.io:1433;databaseName=app;encrypt=true;trustServerCertificate=true"], "without checking the server's certificate"],
    ["internal/db/mysql.go", ["\tdb, err := sql.Open(\"mysql\", \"app@tcp(mysql.acme.io:3306)/app?tls=false\")"], "without TLS"],
    ["app/settings.py", ["DATABASE_URL = 'mysql://app@10.0.4.12/app?ssl-mode=DISABLED'"], "without TLS"],
    ["k8s/secret.yaml", ["  MONGO_URI: mongodb+srv://app@cluster0.abcde.mongodb.net/app?tls=false"], "without TLS"],
    ["Api/appsettings.json", ["  \"Default\": \"Server=tcp:acme.database.windows.net,1433;Database=app;Encrypt=False;\""], "without TLS"],
    ["Api/appsettings.json", ["  \"Default\": \"Data Source=sql.acme.io;Initial Catalog=app;TrustServerCertificate=True\""], "without checking the server's certificate"],
    ["src/db.ts", ["const pool = new sql.ConnectionPool({", "  server: 'acme.database.windows.net',", "  options: {", "    encrypt: false,", "  },", "});"], "without TLS"]
  ];
  for (const [path, lines, how] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.includes(` ${how}, so`), `${path}: ${result[0]?.message}`);
  }
}

export function testDatabaseTlsDisabledSkipsLocalAndSecureConnections(): void {
  const cases: Array<[string, string[]]> = [
    // TLS on.
    ["deploy/app.env", ["DATABASE_URL=postgres://app@db.acme.io/app?sslmode=verify-full", "MONGO_URL=mongodb+srv://app@cluster0.acme.mongodb.net/app"]],
    ["Api/appsettings.json", ["  \"Default\": \"Server=sql.acme.io;Database=app;Encrypt=True;\""]],
    // The same machine and private container networks.
    ["docker-compose.yml", ["      DATABASE_URL: postgres://app@db:5432/app?sslmode=disable", "      MONGO_URL: mongodb://mongo:27017/app?tls=false"]],
    ["deploy/app.env", ["DATABASE_URL=postgres://app@localhost/app?sslmode=disable", "DB=postgres://app@127.0.0.1/app?sslmode=disable"]],
    ["k8s/deployment.yaml", ["          value: postgres://app@postgres.default.svc.cluster.local/app?sslmode=disable"]],
    // Hosts filled in later, and documentation hosts.
    ["deploy/app.env", ["DATABASE_URL=postgres://app@${DB_HOST}/app?sslmode=disable", "DB=postgres://app@db.example.com/app?sslmode=disable"]],
    // `encrypt: false` with no remote server nearby.
    ["src/config.ts", ["const settings = { encrypt: false, compress: true };"]],
    // Comments, documentation, and development setups.
    ["deploy/app.env", ["# DATABASE_URL=postgres://app@db.acme.io/app?sslmode=disable"]],
    ["docs/database.md", ["postgres://app@db.acme.io/app?sslmode=disable"]],
    ["config/database.dev.yml", ["url: postgres://app@db.acme.io/app?sslmode=disable"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testDatabaseTlsDisabledSkipsTestsAndCanBeDisabled(): void {
  const lines = ["DATABASE_URL=postgres://app@db.acme.io/app?sslmode=disable"];
  assert.deepEqual(findings([added("tests/fixtures/app.env", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { databaseTlsDisabled: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/app.env", lines)], config), []);
}
