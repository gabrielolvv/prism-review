import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Kind = "sslError" | "debuggable" | "fileAccess" | "cleartext" | "userCertificates" | "mixedContent" | "webDebugging";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  sslError: "a WebView that loads pages despite certificate errors",
  debuggable: "a debuggable Android build",
  fileAccess: "WebView pages from file:// URLs that can read other files and origins",
  cleartext: "plain HTTP traffic",
  userCertificates: "trust in certificate authorities the user installs",
  mixedContent: "HTTP content inside HTTPS pages",
  webDebugging: "WebView remote debugging"
};

const high = new Set<Kind>(["sslError", "debuggable", "fileAccess"]);

type Setting = { kind: Kind; files: RegExp; pattern: RegExp; guarded?: boolean };

const manifest = /(?:^|\/)AndroidManifest\.xml$/i;
const androidCode = /\.(?:java|kt)$/i;
const iosCode = /\.(?:swift|m|mm)$/i;
const reactNative = /\.(?:[jt]sx|[cm]?js|ts)$/i;
const appConfig = /(?:^|\/)(?:app\.json|app\.config\.[cm]?[jt]s|capacitor\.config\.(?:json|[cm]?[jt]s))$/i;

const settings: Setting[] = [
  { kind: "debuggable", files: manifest, pattern: /\bandroid:debuggable\s*=\s*"true"/ },
  { kind: "cleartext", files: manifest, pattern: /\bandroid:usesCleartextTraffic\s*=\s*"true"/ },
  // Android's network security config, where only the app-wide base-config counts.
  { kind: "cleartext", files: /\.xml$/i, pattern: /<base-config\b[^>]*\bcleartextTrafficPermitted\s*=\s*"true"/ },
  // WebView settings in Java and Kotlin, unless a condition or debug check comes just before.
  {
    kind: "fileAccess",
    files: androidCode,
    pattern: /\bsetAllow(?:Universal|File)AccessFromFileURLs\s*\(\s*true\s*\)|\ballow(?:Universal|File)AccessFromFileURLs\s*=\s*true\b/,
    guarded: true
  },
  { kind: "mixedContent", files: androidCode, pattern: /\bMIXED_CONTENT_ALWAYS_ALLOW\b/, guarded: true },
  { kind: "webDebugging", files: androidCode, pattern: /\bsetWebContentsDebuggingEnabled\s*\(\s*true\s*\)/, guarded: true },
  { kind: "webDebugging", files: iosCode, pattern: /\.isInspectable\s*=\s*(?:true|YES)\b|\bsetInspectable\s*:\s*YES\b/, guarded: true },
  // react-native-webview props.
  { kind: "fileAccess", files: reactNative, pattern: /\ballow(?:Universal|File)AccessFromFileURLs(?:\s*=\s*\{\s*true\s*\}|(?=\s*(?:\/?>|$)))/, guarded: true },
  { kind: "mixedContent", files: reactNative, pattern: /\bmixedContentMode\s*=\s*(?:\{\s*)?["']always["']/, guarded: true },
  { kind: "webDebugging", files: reactNative, pattern: /\bwebviewDebuggingEnabled(?:\s*=\s*\{\s*true\s*\}|(?=\s*(?:\/?>|$)))/, guarded: true },
  // Expo's and Capacitor's app settings.
  { kind: "cleartext", files: appConfig, pattern: /["']?(?:usesCleartextTraffic|cleartext|NSAllowsArbitraryLoads)["']?\s*:\s*true\b/ },
  { kind: "mixedContent", files: appConfig, pattern: /["']?allowMixedContent["']?\s*:\s*true\b/ },
  { kind: "webDebugging", files: appConfig, pattern: /["']?webContentsDebuggingEnabled["']?\s*:\s*true\b/ }
];

// A condition or debug check in the lines before, as libraries put these behind an option or a
// debug build, or a helper named for debugging that is called only in one.
const guard = /\bif\b|#if\b|\bwhen\s*[({]|\s\?\s|__DEV__|\bDEBUG\b|[Dd]ebuggable|\b\w*Debug\w*\s*\([^)]*\)\s*(?:\{|$)|\bisDev\b/;
const guardWindow = 3;
// How far back to look for the line that opens the enclosing block.
const blockWindow = 30;

// Accepting a certificate error: `handler.proceed()` in a WebViewClient's onReceivedSslError.
const sslErrorHandler = /\bonReceivedSslError\b/;
const proceed = /\b\w+\.proceed\s*\(\s*\)/;

// Info.plist: App Transport Security turned off for every connection or for web content.
const plistKey = /<key>\s*(NSAllowsArbitraryLoads(?:InWebContent)?)\s*<\/key>/;
const plistTrue = /^\s*<true\s*\/>/;

// Android's network security config: user certificate authorities trusted outside debug-overrides.
const userCertificates = /<certificates\b[^>]*\bsrc\s*=\s*"user"/;

// Android's debug source set and iOS debug configurations are only built for development.
const debugSourceSet = /(?:^|\/)src\/debug\//i;

const commentLine = /^\s*(?:\/\/|\/\*|\*|<!--|#)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const mobileSecurityRule: Rule = {
  id: "mobile-security",
  description: "Flags debuggable Android builds, plain HTTP allowed by Android or App Transport Security, and WebViews that ignore certificate errors or open file access, mixed content, or remote debugging.",
  run({ files, config }) {
    if (!config.rules.mobileSecurity.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        debugSourceSet.test(file.path) ||
        // Development, example, and test apps turn these on on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const plist = /\.plist$/i.test(file.path);
      const xml = /\.xml$/i.test(file.path);
      const android = androidCode.test(file.path);
      if (fileSettings.length === 0 && !plist && !xml) {
        return [];
      }

      const lines = patchLines(file.patch);
      const handlesSslErrors = android && lines.some(({ content }) => sslErrorHandler.test(content));
      const found: Array<{ line: number; kind: Kind }> = [];
      let lastPlistKey: string | undefined;
      let inDebugOverrides = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          lastPlistKey = undefined;
          inDebugOverrides = false;
        }
        if (xml) {
          if (/<debug-overrides\b/.test(content)) {
            inDebugOverrides = true;
          }
          if (/<\/debug-overrides>/.test(content)) {
            inDebugOverrides = false;
          }
        }
        const key = plist ? plistKey.exec(content)?.[1] : undefined;
        const previousKey = lastPlistKey;
        if (plist && content.trim() !== "") {
          lastPlistKey = key;
        }
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }

        const guarded = (): boolean =>
          lines.slice(Math.max(0, index - guardWindow), index + 1).some(({ content: before }) => guard.test(before)) || guard.test(enclosingBlock(lines, index));
        for (const setting of fileSettings) {
          if (setting.pattern.test(content) && !(setting.guarded === true && guarded())) {
            found.push({ line, kind: setting.kind });
          }
        }
        if (handlesSslErrors && proceed.test(content) && !guarded()) {
          found.push({ line, kind: "sslError" });
        }
        if (plist && previousKey !== undefined && plistTrue.test(content)) {
          found.push({ line, kind: "cleartext" });
        }
        if (xml && !inDebugOverrides && userCertificates.test(content)) {
          found.push({ line, kind: "userCertificates" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      return [
        {
          ruleId: "mobile-security",
          title: "Insecure mobile app setting",
          severity: kinds.some((kind) => high.has(kind)) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${plural ? "allow" : "allows"} ${kinds.map((kind) => labels[kind]).join(", and ")}, which lets someone on the same network, another app, or a page loaded in the app read or change what the app sends and stores.`,
          recommendation:
            "Leave `android:debuggable` to the build type, keep traffic on HTTPS and list any HTTP hosts by name in a network security config or `NSExceptionDomains`, call `handler.cancel()` on certificate errors, and turn on WebView file access, mixed content, and remote debugging only in debug builds."
        }
      ];
    });
  }
};

// The nearest line before that is indented less, which opens the block this line is in.
function enclosingBlock(lines: Array<{ content: string }>, index: number): string {
  const indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - blockWindow); before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      return content;
    }
  }
  return "";
}
