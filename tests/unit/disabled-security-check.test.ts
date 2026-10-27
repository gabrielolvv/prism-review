import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testDisabledSecurityCheckRuleReportsEachLanguage(): void {
  const findings = checkFindings([
    file("src/http.ts", [
      "const agent = new https.Agent({ rejectUnauthorized: false });",
      'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";',
      'jwt.verify(token, key, { algorithms: ["none"], ignoreExpiration: true });'
    ]),
    file("app/client.py", [
      "response = requests.get(url, verify=False)",
      "context = ssl._create_unverified_context()",
      'claims = jwt.decode(token, options={"verify_signature": False})'
    ]),
    file("pkg/client.go", ["\ttr := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}"]),
    file("src/main/java/Client.java", ["    .setSSLHostnameVerifier(NoopHostnameVerifier.INSTANCE)"]),
    file("src/Client.cs", ["handler.ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true;"]),
    file("lib/api.php", ["curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);"]),
    file("lib/client.rb", ["http.verify_mode = OpenSSL::SSL::VERIFY_NONE"]),
    file("scripts/fetch.sh", ["curl -fsSLk https://internal.example/data.json -o data.json", "git config --global http.sslVerify false"]),
    file("src/main/java/SecurityConfig.java", ["        http.csrf(AbstractHttpConfigurer::disable);", "        http.csrf().disable();"]),
    file("app/views.py", ["@csrf_exempt", "def webhook(request):"]),
    file("app/controllers/api_controller.rb", ["  skip_before_action :verify_authenticity_token"])
  ]);

  const byFile = new Map(findings.map((finding) => [finding.file, finding]));
  assert.deepEqual([...byFile.keys()].sort(), [
    "app/client.py",
    "app/controllers/api_controller.rb",
    "app/views.py",
    "lib/api.php",
    "lib/client.rb",
    "pkg/client.go",
    "scripts/fetch.sh",
    "src/Client.cs",
    "src/http.ts",
    "src/main/java/Client.java",
    "src/main/java/SecurityConfig.java"
  ]);
  assert.equal(
    byFile.get("src/http.ts")?.message,
    "Lines 1, 2, 3 turn off security checks: TLS certificate verification, and token signature or expiry checks."
  );
  assert.equal(byFile.get("src/http.ts")?.severity, "high");
  assert.equal(
    byFile.get("app/client.py")?.message,
    "Lines 1, 2, 3 turn off security checks: TLS certificate verification, and token signature or expiry checks."
  );
  assert.equal(byFile.get("app/views.py")?.message, "Line 1 turns off a security check: CSRF protection.");
  assert.equal(byFile.get("app/views.py")?.severity, "warning");
  assert.equal(byFile.get("src/main/java/SecurityConfig.java")?.line, 1);
}

export function testDisabledSecurityCheckRuleIgnoresSafeCodeDocsAndTests(): void {
  const findings = checkFindings([
    file("src/http.ts", [
      "const agent = new https.Agent({ rejectUnauthorized: true });",
      "// rejectUnauthorized: false only for local development",
      "const options = { verify: false };",
      'const decoded = jwt.decode(token); // read claims without trusting them'
    ]),
    file("app/client.py", ["response = requests.get(url, verify=certifi.where())", "settings.DEBUG_VERIFY = False"]),
    file("scripts/fetch.sh", [
      "curl -fsSL https://example.com/data.json -o data.json",
      "curl -H 'Authorization: Bearer x' --keepalive-time 5 https://example.com"
    ]),
    file("docs/proxy.md", ["Set `NODE_TLS_REJECT_UNAUTHORIZED=0` only on your own machine."]),
    file("tests/unit/client.test.ts", ["const agent = new https.Agent({ rejectUnauthorized: false });"]),
    file("app/tests/test_views.py", ["@csrf_exempt"])
  ]);

  assert.deepEqual(findings, []);
}

export function testDisabledSecurityCheckRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { disabledSecurityChecks: { enabled: false } } });
  const files = [file("app/client.py", ["requests.get(url, verify=False)"])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "disabled-security-check"));
}

function checkFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "disabled-security-check");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
