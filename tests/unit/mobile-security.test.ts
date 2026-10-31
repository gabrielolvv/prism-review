import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { mobileSecurityRule } from "../../src/rules/mobile-security.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return mobileSecurityRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testMobileSecurityReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("android/app/src/main/AndroidManifest.xml", [
      "<application",
      '    android:debuggable="true"',
      '    android:usesCleartextTraffic="true"',
      '    android:label="@string/app_name">'
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Insecure mobile app setting");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 allow a debuggable Android build, and plain HTTP traffic, which lets someone on the same network, another app, or a page loaded in the app read or change what the app sends and stores."
  );
}

export function testMobileSecurityReadsEachPlatform(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["android/app/src/main/res/xml/network_security_config.xml", ["<network-security-config>", '  <base-config cleartextTrafficPermitted="true" />', "</network-security-config>"], "warning"],
    [
      "android/app/src/main/res/xml/network_security_config.xml",
      ["<base-config>", "  <trust-anchors>", '    <certificates src="system" />', '    <certificates src="user" />', "  </trust-anchors>", "</base-config>"],
      "warning"
    ],
    ["ios/App/Info.plist", ["<key>NSAppTransportSecurity</key>", "<dict>", "  <key>NSAllowsArbitraryLoads</key>", "  <true/>", "</dict>"], "warning"],
    [
      "app/src/main/java/com/acme/AppWebViewClient.java",
      ["@Override", "public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {", "    handler.proceed();", "}"],
      "high"
    ],
    ["app/src/main/java/com/acme/MainActivity.java", ["settings.setAllowUniversalAccessFromFileURLs(true);"], "high"],
    ["app/src/main/java/com/acme/MainActivity.kt", ["webView?.settings?.allowFileAccessFromFileURLs = true"], "high"],
    ["app/src/main/java/com/acme/MainActivity.kt", ["webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW"], "warning"],
    ["app/src/main/java/com/acme/MainApplication.java", ["WebView.setWebContentsDebuggingEnabled(true);"], "warning"],
    ["ios/App/WebViewController.swift", ["webView.isInspectable = true"], "warning"],
    ["src/screens/Browser.tsx", ["<WebView", "  source={{ uri }}", '  mixedContentMode="always"', "  allowUniversalAccessFromFileURLs={true}", "/>"], "high"],
    ["app.json", ['      "usesCleartextTraffic": true'], "warning"],
    ["capacitor.config.ts", ["  android: { allowMixedContent: true, webContentsDebuggingEnabled: true },"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testMobileSecuritySkipsGuardedAndSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    ["android/app/src/main/AndroidManifest.xml", ['<application android:usesCleartextTraffic="false" android:allowBackup="true">']],
    // HTTP allowed for named hosts only, and user certificates only in debug builds.
    ["app/src/main/res/xml/network_security_config.xml", ['<domain-config cleartextTrafficPermitted="true">', '  <domain includeSubdomains="true">10.0.2.2</domain>', "</domain-config>"]],
    ["app/src/main/res/xml/network_security_config.xml", ["<debug-overrides>", "  <trust-anchors>", '    <certificates src="user" />', "  </trust-anchors>", "</debug-overrides>"]],
    ["ios/App/Info.plist", ["<key>NSAllowsArbitraryLoads</key>", "<false/>", "<key>UIRequiresFullScreen</key>", "<true/>"]],
    // Behind a debug check or an option, as libraries such as react-native-webview and Cordova do.
    ["android/src/main/java/RNCWebViewManagerImpl.kt", ["if (ReactBuildConfig.DEBUG) {", "    WebView.setWebContentsDebuggingEnabled(true)", "}"]],
    [
      "framework/src/SystemWebViewEngine.java",
      [
        '        if (preferences.getBoolean("AndroidInsecureFileModeEnabled", false)) {',
        "            // These settings are deprecated,",
        "            // but allowed for compatibility.",
        '            LOG.d(TAG, "Enabled insecure file access");',
        "            settings.setAllowFileAccess(true);",
        "            settings.setAllowUniversalAccessFromFileURLs(true);",
        "        }"
      ]
    ],
    [
      "framework/src/SystemWebViewClient.java",
      ["public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {", "    if ((appInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {", "        handler.proceed();", "    }"]
    ],
    ["src/screens/Browser.tsx", ["<WebView webviewDebuggingEnabled={__DEV__} mixedContentMode=\"never\" />"]],
    ["ios/App/WebViewController.swift", ["#if DEBUG", "webView.isInspectable = true", "#endif"]],
    // HTTP authentication, not a certificate error.
    ["app/src/main/java/AuthClient.java", ["public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {", "    handler.proceed(user, password);", "}"]],
    // The debug source set, and comments.
    ["android/app/src/debug/AndroidManifest.xml", ['<application android:usesCleartextTraffic="true" />']],
    ["app/src/main/java/com/acme/MainActivity.java", ["// settings.setAllowUniversalAccessFromFileURLs(true);"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testMobileSecuritySkipsTestsAndCanBeDisabled(): void {
  const line = '<application android:debuggable="true" />';
  assert.deepEqual(findings([added("app/src/test/AndroidManifest.xml", [line]), added("fixtures/AndroidManifest.xml", [line]), added("docs/android.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { mobileSecurity: { enabled: false } } });
  assert.deepEqual(findings([added("app/src/main/AndroidManifest.xml", [line])], config), []);
}
