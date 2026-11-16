import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { androidExportedComponentRule } from "../../src/rules/android-exported-component.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return androidExportedComponentRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const manifest = (...components: string[]) => [
  "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">",
  "    <application android:label=\"@string/app_name\">",
  ...components,
  "    </application>",
  "</manifest>"
];
const path = "app/src/main/AndroidManifest.xml";

export function testAndroidExportedComponentReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(
      path,
      manifest(
        "        <service",
        "            android:name=\".sync.SyncService\"",
        "            android:exported=\"true\">",
        "            <intent-filter>",
        "                <action android:name=\"com.acme.notes.SYNC\" />",
        "            </intent-filter>",
        "        </service>"
      )
    )
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Android component open to every app");
  assert.deepEqual(finding?.lines, [5]);
  assert.equal(
    finding?.message,
    "Line 5 exports the service `.sync.SyncService` with no permission, so any app installed on the device can call it and use this app's data and permissions through it."
  );
}

export function testAndroidExportedComponentReadsEachKind(): void {
  const cases: string[][] = [
    manifest("        <provider android:name=\".data.NotesProvider\" android:authorities=\"com.acme.notes\" android:exported=\"true\" />"),
    manifest(
      "        <receiver android:name=\".CommandReceiver\" android:exported=\"true\">",
      "            <intent-filter>",
      "                <action android:name=\"com.acme.notes.DELETE_ALL\" />",
      "            </intent-filter>",
      "        </receiver>"
    ),
    manifest("        <receiver android:name=\".WidgetReceiver\" android:exported=\"true\" />")
  ];
  for (const lines of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, lines.join(" | "));
  }
}

export function testAndroidExportedComponentSkipsProtectedComponents(): void {
  const cases: string[][] = [
    // Components kept to this app, or protected by a permission.
    manifest("        <service android:name=\".sync.SyncService\" android:exported=\"false\" />"),
    manifest("        <service android:name=\".TileService\" android:exported=\"true\" android:permission=\"android.permission.BIND_QUICK_SETTINGS_TILE\" />"),
    manifest("        <provider android:name=\".data.NotesProvider\" android:exported=\"true\" android:readPermission=\"com.acme.notes.READ\" />"),
    manifest(
      "        <provider android:name=\".data.NotesProvider\" android:exported=\"true\">",
      "            <path-permission android:pathPrefix=\"/notes\" android:permission=\"com.acme.notes.ACCESS\" />",
      "        </provider>"
    ),
    // Receivers and services for Android's own broadcasts and interfaces.
    manifest(
      "        <receiver android:name=\".BootReceiver\" android:exported=\"true\">",
      "            <intent-filter>",
      "                <action android:name=\"android.intent.action.BOOT_COMPLETED\" />",
      "            </intent-filter>",
      "        </receiver>"
    ),
    manifest(
      "        <receiver android:name=\".BootReceiver\" android:exported=\"true\">",
      "            <intent-filter>",
      "                <action android:name=\"android.intent.action.BOOT_COMPLETED\" />",
      "                <action android:name=\"com.htc.intent.action.QUICKBOOT_POWERON\" />",
      "            </intent-filter>",
      "        </receiver>"
    ),
    manifest(
      "        <service android:name=\".WearListener\" android:exported=\"true\">",
      "            <intent-filter>",
      "                <action android:name=\"com.google.android.gms.wearable.MESSAGE_RECEIVED\" />",
      "            </intent-filter>",
      "        </service>"
    ),
    manifest(
      "        <service android:name=\".PlaybackService\" android:exported=\"true\">",
      "            <intent-filter>",
      "                <action android:name=\"android.media.browse.MediaBrowserService\" />",
      "            </intent-filter>",
      "        </service>"
    ),
    // Activities, components removed from merged manifests, and commented-out components.
    manifest("        <activity android:name=\".MainActivity\" android:exported=\"true\" />"),
    manifest("        <service android:name=\"com.lib.Tracker\" android:exported=\"true\" tools:node=\"remove\" />"),
    manifest("        <!-- <service android:name=\".Old\" android:exported=\"true\" /> -->")
  ];
  for (const lines of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], lines.join(" | "));
  }
}

export function testAndroidExportedComponentSkipsTestsAndCanBeDisabled(): void {
  const lines = manifest("        <provider android:name=\".data.NotesProvider\" android:exported=\"true\" />");
  assert.deepEqual(findings([added("app/src/debug/AndroidManifest.xml", lines)]), []);
  assert.deepEqual(findings([added("app/src/androidTest/AndroidManifest.xml", lines)]), []);
  assert.deepEqual(findings([added("samples/demo/src/main/AndroidManifest.xml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { androidExportedComponent: { enabled: false } } });
  assert.deepEqual(findings([added(path, lines)], config), []);
}
