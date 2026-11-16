import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "world" | "backup" | "keychain" | "files";
type Exposure = { line: number; kind: Kind };

const androidCode = /\.(?:java|kt)$/i;
const appleCode = /\.(?:swift|m|mm)$/i;
const manifestFile = /(?:^|\/)AndroidManifest\.xml$/;
// Debug, QA, and instrumentation-test manifests and code, which only internal builds and tests use,
// Xcode test targets, and dependencies vendored by Carthage and CocoaPods.
const debugSourceSet = /(?:^|\/)src\/(?:debug|qa|androidTest|test|testDebug|benchmark)\/|(?:^|\/)[^/]*Tests?\.(?:swift|m|mm)$|(?:^|\/)[^/]*Tests\/|(?:^|\/)(?:Carthage|Pods)\//i;

// Files and preferences that every app on the device can read or write.
const worldMode = /\bMODE_WORLD_(?:READABLE|WRITEABLE)\b/;
// Keychain items readable while the device is locked, in the Security framework and in KeychainAccess,
// keychain-swift, SwiftKeychainWrapper, and Valet.
const keychainAlways =
  /\bkSecAttrAccessibleAlways(?:ThisDeviceOnly)?\b|\.accessibility\(\s*\.always(?:ThisDeviceOnly)?\s*\)|\.accessibleAlways(?:ThisDeviceOnly)?\b|\bKeychainItemAccessibility\.always(?:ThisDeviceOnly)?\b|\bAccessibility\.always(?:ThisDeviceOnly)?\b/;
// Files written without data protection, which stay readable while the device is locked.
const fileProtectionNone = /\bNSFileProtectionNone\b|\bNSDataWritingFileProtectionNone\b|\.noFileProtection\b|\bFileProtectionType\.none\b|\.protectionKey\s*:\s*\.none\b/;
const applicationStart = /<application\b/;
const allowBackup = /\bandroid:allowBackup\s*=\s*"true"/;
const backupRules = /\bandroid:(?:fullBackupContent|dataExtractionRules)\s*=/;
const commentLine = /^\s*(?:\/\/|\*|\/\*|<!--)/;
// Imports, constant definitions, and `case` labels name the settings without using them, as wrapper
// libraries do when they map their own options to the Security framework's.
const definitionLine = /^\s*(?:import|case|#define|public\s+static\s+final|const\s+val)\b|^\s*\.\w+\s*:\s*kSecAttrAccessible/;
// A comment at the end of a line, such as `// kSecAttrAccessibleAlways, but hardcoded`.
const trailingComment = /(?:^|\s)\/\/.*$/;
const maxTagLines = 40;

// A `return` right after a `case` label, as in a wrapper's `case .always: return kSecAttrAccessibleAlways`.
const caseLabel = /^\s*case\b.*:\s*$/;
const returnLine = /^\s*return\b/;

function codeExposures(lines: PatchLine[], android: boolean): Exposure[] {
  let previous = "";
  return lines.flatMap(({ line, content, added, startsHunk }): Exposure[] => {
    const afterCase = !startsHunk && caseLabel.test(previous);
    if (content.trim() !== "") {
      previous = content;
    }
    if (!added || commentLine.test(content) || definitionLine.test(content) || (returnLine.test(content) && afterCase)) {
      return [];
    }
    const code = content.replace(trailingComment, "");
    if (android) {
      return worldMode.test(code) ? [{ line, kind: "world" }] : [];
    }
    if (keychainAlways.test(code)) {
      return [{ line, kind: "keychain" }];
    }
    return fileProtectionNone.test(code) ? [{ line, kind: "files" }] : [];
  });
}

// `<application android:allowBackup="true">` without rules for what backups leave out.
function manifestExposures(lines: PatchLine[]): Exposure[] {
  const found: Exposure[] = [];
  lines.forEach(({ content }, index) => {
    if (!applicationStart.test(content) || commentLine.test(content)) {
      return;
    }
    const tag: PatchLine[] = [];
    for (const line of lines.slice(index, index + maxTagLines)) {
      if (tag.length > 0 && line.startsHunk) {
        break;
      }
      tag.push(line);
      if (/>/.test(line.content.slice(tag.length === 1 ? line.content.indexOf("<application") : 0))) {
        break;
      }
    }
    const backup = tag.find(({ content: text }) => allowBackup.test(text));
    if (backup !== undefined && backup.added && !tag.some(({ content: text }) => backupRules.test(text))) {
      found.push({ line: backup.line, kind: "backup" });
    }
  });
  return found;
}

const phrases: Record<Kind, string> = {
  world: "makes files or preferences readable or writable by every app on the device",
  backup:
    "lets Android back up all of its data, including tokens and databases, with no rules for what to leave out, so anyone with the unlocked phone and `adb backup` can copy it",
  keychain: "keeps Keychain items readable while the device is locked, an option Apple has deprecated",
  files: "writes files without data protection, so they stay readable while the device is locked"
};

export const mobileDataProtectionRule: Rule = {
  id: "mobile-data-protection",
  description:
    "Flags mobile app data left readable: Android's `MODE_WORLD_READABLE` and `allowBackup` without backup rules, and iOS Keychain items and files readable while the device is locked.",
  run({ files, config }) {
    if (!config.rules.mobileDataProtection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const android = androidCode.test(file.path);
      const manifest = manifestFile.test(file.path);
      if (
        (!android && !manifest && !appleCode.test(file.path)) ||
        file.patch === undefined ||
        debugSourceSet.test(file.path) ||
        // Sample, demo, and test apps.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found = manifest ? manifestExposures(lines) : codeExposures(lines, android);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text } = describeLines(lineNumbers);
      const kinds = [...new Set(found.map(({ kind }) => kind))];
      return [
        {
          ruleId: "mobile-data-protection",
          title: "Mobile app data left readable",
          severity: kinds.includes("world") ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the app ${listOf(kinds.map((kind) => phrases[kind]))}.`,
          recommendation:
            "On Android, keep files and preferences in `MODE_PRIVATE` and share them through a `FileProvider`, and set `android:allowBackup=\"false\"` or give `android:dataExtractionRules` and `android:fullBackupContent` rules that leave out tokens and credentials. On iOS, store Keychain items with `kSecAttrAccessibleWhenUnlocked` or `kSecAttrAccessibleAfterFirstUnlock`, with `ThisDeviceOnly` for secrets, and write files with `.completeFileProtection` or `.completeUnlessOpen`."
        }
      ];
    });
  }
};
