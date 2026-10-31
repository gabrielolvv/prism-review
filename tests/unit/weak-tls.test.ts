import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakTlsRule } from "../../src/rules/weak-tls.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakTlsRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakTlsReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/nginx.conf", [
      "server {",
      "    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;",
      "    ssl_ciphers HIGH:RC4-SHA:!aNULL:!MD5;",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Old TLS version or cipher allowed");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 allow SSL 3, TLS 1.0, or TLS 1.1, and allow RC4, DES, NULL, export, or anonymous cipher suites, which attacks such as POODLE, BEAST, and Sweet32 can break or downgrade a connection to."
  );
}

export function testWeakTlsReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/server.js", ["const server = https.createServer({ key, cert, minVersion: 'TLSv1' });"]],
    ["src/client.ts", ["const agent = new https.Agent({ secureProtocol: 'TLSv1_method' });"]],
    ["app/client.py", ["context = ssl.SSLContext(ssl.PROTOCOL_TLSv1)"]],
    ["app/client.py", ["context.minimum_version = ssl.TLSVersion.TLSv1_1"]],
    ["server.go", ["cfg := &tls.Config{MinVersion: tls.VersionTLS10}"]],
    ["src/Client.java", ['SSLContext context = SSLContext.getInstance("TLSv1.1");']],
    ["src/Client.java", ['socket.setEnabledProtocols(new String[] {"TLSv1", "TLSv1.2"});']],
    ["Services/Client.cs", ["ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls11;"]],
    ["lib/client.rb", ["http.ssl_version = :TLSv1"]],
    ["src/client.php", ["curl_setopt($ch, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_0);"]],
    ["conf/ssl.conf", ["SSLProtocol all -SSLv3"]],
    ["src/main/resources/application.yml", ["    enabled-protocols: TLSv1.1,TLSv1.2"]],
    ["infra/lb.tf", ['  ssl_policy        = "ELBSecurityPolicy-2016-08"']],
    ["infra/cdn.tf", ['    minimum_protocol_version = "TLSv1_2016"']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakTlsSkipsCurrentSettings(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/nginx.conf", ["ssl_protocols TLSv1.2 TLSv1.3;", "ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:!aNULL:!eNULL:!RC4:!DES;"]],
    ["conf/ssl.conf", ["SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1"]],
    ["src/server.js", ["const server = https.createServer({ key, cert, minVersion: 'TLSv1.2' });"]],
    ["app/client.py", ["context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)", "context.minimum_version = ssl.TLSVersion.TLSv1_2"]],
    ["server.go", ["cfg := &tls.Config{MinVersion: tls.VersionTLS12}"]],
    ["src/Client.java", ['SSLContext context = SSLContext.getInstance("TLS");']],
    ["Services/Client.cs", ["ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;"]],
    ["infra/lb.tf", ['  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"']],
    // Compatibility tables, docstrings, and comments mention old protocols without using them.
    ["urllib3/contrib/pyopenssl.py", ["_openssl_versions = {", "    ssl.PROTOCOL_TLSv1: OpenSSL.SSL.TLSv1_METHOD,", "}"]],
    ["gunicorn/config.py", ['    """', "    The default value has been changed from ``ssl.PROTOCOL_TLSv1``.", '    """']],
    ["deploy/nginx.conf", ["# ssl_protocols TLSv1 TLSv1.1 TLSv1.2;"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakTlsSkipsTestsAndCanBeDisabled(): void {
  const line = "const server = https.createServer({ minVersion: 'TLSv1' });";
  assert.deepEqual(findings([added("test/server.test.js", [line]), added("fixtures/server.js", [line]), added("docs/tls.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { weakTls: { enabled: false } } });
  assert.deepEqual(findings([added("src/server.js", [line])], config), []);
}
