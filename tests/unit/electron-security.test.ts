import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { electronSecurityRule } from "../../src/rules/electron-security.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return electronSecurityRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testElectronSecurityReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/prompt.js", [
      "const win = new BrowserWindow({",
      "  webPreferences: {",
      "    nodeIntegration: true,",
      "    contextIsolation: false",
      "  }",
      "});"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Electron security setting weakened");
  assert.deepEqual(finding?.lines, [3, 4]);
  assert.equal(
    finding?.message,
    "Lines 3, 4 weaken Electron's isolation between web content and the computer (nodeIntegration: true, contextIsolation: false). A script injected into the page, through XSS or a URL it loads, can then use Node.js or other sites' data and run commands on the user's computer."
  );
}

export function testElectronSecurityReadsEachSetting(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["src/main.ts", ["new BrowserWindow({ webPreferences: { webSecurity: false } });"], "high"],
    ["src/main.ts", ["new BrowserWindow({ webPreferences: { nodeIntegrationInSubFrames: true } });"], "high"],
    ["src/main.js", ["const { app } = require('electron');", "app.commandLine.appendSwitch('ignore-certificate-errors');"], "high"],
    [
      "src/main.js",
      ["const { app } = require('electron');", "app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {", "  event.preventDefault();", "  callback(true);", "});"],
      "high"
    ],
    ["src/index.html", ['<webview src="https://example.com" nodeintegration></webview>'], "high"],
    ["src/main.ts", ["webPreferences: {", "  preload: join(__dirname, '../preload/index.js'),", "  sandbox: false", "}"], "warning"],
    ["src/main.ts", ["new BrowserWindow({ webPreferences: { allowRunningInsecureContent: true } });"], "warning"],
    ["src/main.js", ["const { app } = require('electron');", "app.commandLine.appendSwitch('no-sandbox');"], "warning"],
    // Quoted keys, as in a JSON file of window options.
    ["config/window.json", ['{ "webPreferences": { "contextIsolation": false } }'], "high"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testElectronSecuritySkipsSafeSettingsAndOtherTools(): void {
  const cases: Array<[string, string[]]> = [
    // Electron's defaults, written out.
    ["src/main.ts", ["new BrowserWindow({", "  webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }", "});"]],
    // Options with the same names outside Electron, such as an iframe sandbox or Puppeteer.
    ["src/embed.js", ["const frame = { sandbox: false, src: url };"]],
    ["scripts/render.js", ["const browser = await puppeteer.launch({ args: ['--disable-web-security'] });"]],
    // Certificate errors that are reported rather than accepted.
    ["src/main.js", ["const { app } = require('electron');", "app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {", "  callback(false);", "});"]],
    // Text that mentions a setting, such as a message.
    ["src/main.js", ["const { BrowserWindow } = require('electron');", 'const hint = "Set nodeIntegration: true to use require in the page";']],
    // Comments, such as a template explaining how to turn a setting on.
    ["src/renderer.js", [" * mainWindow = new BrowserWindow({", " *   webPreferences: {", " *     nodeIntegration: true"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testElectronSecuritySkipsTestsAndCanBeDisabled(): void {
  const lines = ["new BrowserWindow({ webPreferences: { nodeIntegration: true } });"];
  assert.deepEqual(findings([added("test/window.test.js", lines), added("fixtures/main.js", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { electronSecurity: { enabled: false } } });
  assert.deepEqual(findings([added("src/main.js", lines)], config), []);
}
