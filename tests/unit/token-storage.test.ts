import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { tokenStorageRule } from "../../src/rules/token-storage.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return tokenStorageRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testTokenStorageReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth/session.ts", [
      "export function saveSession(data: LoginResponse) {",
      "  localStorage.setItem('accessToken', data.access_token);",
      "  localStorage.setItem('theme', data.theme);",
      "  localStorage.refreshToken = data.refresh_token;",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Token kept in readable storage");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 keep auth tokens where other code can read them: any script on the page can read web storage, so one cross-site scripting bug hands the token to an attacker, and AsyncStorage, SharedPreferences, and UserDefaults are unencrypted files on the device."
  );
}

export function testTokenStorageReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["src/api.js", ["localStorage.setItem('token', res.data.token);"]],
    ["src/api.js", ["window.sessionStorage.setItem(\"jwt\", jwt);"]],
    ["src/store/auth.ts", ["localStorage['id_token'] = idToken;"]],
    ["src/components/Login.vue", ["      sessionStorage.setItem(`authToken`, token)"]],
    ["app/services/auth.ts", ["await AsyncStorage.setItem('@auth_token', token);"]],
    ["app/src/main/java/app/AuthStore.kt", ["prefs.edit().putString(\"access_token\", token).apply()"]],
    ["App/AuthStore.swift", ["UserDefaults.standard.set(token, forKey: \"authToken\")"]],
    ["App/AuthStore.m", ["[[NSUserDefaults standardUserDefaults] setObject:token forKey:@\"refresh_token\"];"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testTokenStorageSkipsOtherValues(): void {
  const cases: Array<[string, string[]]> = [
    // Other keys, and tokens that are not secrets of this kind.
    ["src/prefs.ts", ["localStorage.setItem('theme', 'dark');", "sessionStorage.setItem('aposTabId', id);"]],
    ["src/api.js", ["localStorage.setItem('csrfToken', csrf);", "localStorage.setItem('tokenExpiry', String(expiresAt));"]],
    ["app/notifications.ts", ["await AsyncStorage.setItem('pushToken', expoPushToken);"]],
    ["app/src/main/java/app/Push.kt", ["prefs.edit().putString(\"fcm_token\", token).apply()"]],
    // Secure storage, and reading tokens back.
    ["app/src/main/java/app/AuthStore.kt", ["val prefs = EncryptedSharedPreferences.create(context, \"auth\", key, scheme, scheme)", "prefs.edit().putString(\"access_token\", token).apply()"]],
    ["app/services/auth.ts", ["await SecureStore.setItemAsync('token', token);", "const token = localStorage.getItem('token');"]],
    // Comments, as in a library's documentation.
    ["src/client.ts", ["   *     window.localStorage.setItem('oauth_provider_token', session.provider_token)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testTokenStorageSkipsTestsAndCanBeDisabled(): void {
  const line = "localStorage.setItem('token', token);";
  assert.deepEqual(findings([added("src/api.test.js", [line]), added("fixtures/api.js", [line]), added("examples/api.js", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { tokenStorage: { enabled: false } } });
  assert.deepEqual(findings([added("src/api.js", [line])], config), []);
}

export function testTokenStorageSeesLinesRedactionRewrites(): void {
  // Redaction rewrites `localStorage.token = ...` because of the name, so tokens are found before it.
  const files = prepareChangedFiles([added("src/api.js", ["window.localStorage.token = token;"])], defaultConfig);

  assert.match(files[0]?.patch ?? "", /\[REDACTED\]/);
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "token-storage").map((finding) => finding.line),
    [1]
  );
}
