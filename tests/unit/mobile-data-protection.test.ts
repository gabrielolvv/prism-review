import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { mobileDataProtectionRule } from "../../src/rules/mobile-data-protection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return mobileDataProtectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testMobileDataProtectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/src/main/java/com/acme/notes/TokenStore.kt", [
      "class TokenStore(context: Context) {",
      "    private val prefs = context.getSharedPreferences(\"tokens\", Context.MODE_WORLD_READABLE)",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Mobile app data left readable");
  assert.deepEqual(finding?.lines, [2]);
  assert.equal(finding?.message, "In line 2, the app makes files or preferences readable or writable by every app on the device.");
}

export function testMobileDataProtectionReadsEachPlatform(): void {
  const cases: Array<[string, string[], string]> = [
    ["app/src/main/java/com/acme/Export.java", ["FileOutputStream out = openFileOutput(\"export.json\", MODE_WORLD_WRITEABLE);"], "high"],
    ["app/src/main/AndroidManifest.xml", ["<manifest>", "    <application", "        android:allowBackup=\"true\"", "        android:label=\"@string/app_name\">", "    </application>", "</manifest>"], "warning"],
    ["Sources/Auth/TokenStore.swift", ["let query: [String: Any] = [kSecAttrAccessible as String: kSecAttrAccessibleAlways]"], "warning"],
    ["Sources/Auth/TokenStore.swift", ["let keychain = Keychain(service: \"com.acme.notes\").accessibility(.always)"], "warning"],
    ["Sources/Auth/TokenStore.swift", ["keychain.set(token, forKey: \"token\", withAccess: .accessibleAlwaysThisDeviceOnly)"], "warning"],
    ["Sources/Storage/Cache.swift", ["try data.write(to: url, options: .noFileProtection)"], "warning"],
    ["Sources/Storage/Cache.swift", ["try FileManager.default.setAttributes([.protectionKey: FileProtectionType.none], ofItemAtPath: path)"], "warning"],
    ["Classes/Storage/Cache.m", ["[data writeToFile:path options:NSDataWritingFileProtectionNone error:&error];"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const [finding, ...rest] = findings([added(path, lines)]);
    assert.equal(rest.length, 0, `${path}: ${lines.join(" | ")}`);
    assert.equal(finding?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testMobileDataProtectionSkipsProtectedData(): void {
  const cases: Array<[string, string[]]> = [
    // Private files, backups turned off or given rules, and protected Keychain items and files.
    ["app/src/main/java/com/acme/TokenStore.kt", ["val prefs = context.getSharedPreferences(\"tokens\", Context.MODE_PRIVATE)"]],
    ["app/src/main/AndroidManifest.xml", ["<manifest>", "    <application android:allowBackup=\"false\">", "    </application>", "</manifest>"]],
    [
      "app/src/main/AndroidManifest.xml",
      ["<manifest>", "    <application", "        android:allowBackup=\"true\"", "        android:dataExtractionRules=\"@xml/data_extraction_rules\"", "        android:fullBackupContent=\"@xml/backup_rules\">", "    </application>", "</manifest>"]
    ],
    ["Sources/Auth/TokenStore.swift", ["let query: [String: Any] = [kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]"]],
    ["Sources/Storage/Cache.swift", ["try data.write(to: url, options: .completeFileProtection)"]],
    // Wrapper libraries mapping their options, imports, and comments.
    ["Sources/KeychainAccess/Keychain.swift", ["        case .always:", "            return kSecAttrAccessibleAlways"]],
    ["Sources/KeychainAccess/Keychain.swift", ["    case always"]],
    ["Sources/Wrapper/Accessibility.swift", ["    .always: kSecAttrAccessibleAlways,"]],
    ["Sources/Valet/Valet.swift", ["query[kSecAttrAccessible as String] = \"dk\" // kSecAttrAccessibleAlways, hardcoded"]],
    ["Carthage/Checkouts/KeyStore/Lib/KeyStore.m", ["attributes[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAlways;"]],
    ["Sources/Auth/TokenStore.swift", ["// Never use kSecAttrAccessibleAlways here."]],
    ["app/src/main/java/com/acme/Legacy.java", ["import static android.content.Context.MODE_WORLD_READABLE;"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testMobileDataProtectionSkipsTestsAndCanBeDisabled(): void {
  const lines = ["try data.write(to: url, options: .noFileProtection)"];
  assert.deepEqual(findings([added("Tests/StorageTests/CacheTests.swift", lines)]), []);
  assert.deepEqual(findings([added("Lib/KeyStoreTests/KeyStoreTests.m", ["XCTAssertEqualObjects(value, (__bridge id)kSecAttrAccessibleAlways);"])]), []);
  assert.deepEqual(findings([added("app/src/debug/java/com/acme/Debug.kt", ["val prefs = getSharedPreferences(\"x\", MODE_WORLD_READABLE)"])]), []);
  assert.deepEqual(findings([added("samples/demo/Cache.swift", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { mobileDataProtection: { enabled: false } } });
  assert.deepEqual(findings([added("Sources/Storage/Cache.swift", lines)], config), []);
}
