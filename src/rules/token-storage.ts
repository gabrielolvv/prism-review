import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findTokenStorageLines } from "../security/token-storage.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

export const tokenStorageRule: Rule = {
  id: "token-storage",
  description: "Flags auth tokens kept in localStorage, sessionStorage, AsyncStorage, SharedPreferences, or UserDefaults.",
  run({ files, config }) {
    if (!config.rules.tokenStorage.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        // Development, example, and test apps keep tokens wherever is simplest.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = tokenStorageLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "token-storage",
          title: "Token kept in readable storage",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "keep auth tokens" : "keeps an auth token"} where other code can read ${plural ? "them" : "it"}: any script on the page can read web storage, so one cross-site scripting bug hands the token to an attacker, and AsyncStorage, SharedPreferences, and UserDefaults are unencrypted files on the device.`,
          recommendation:
            "In the browser, keep session tokens in HttpOnly, Secure, SameSite cookies that scripts cannot read, or only in memory. On mobile, use the Keychain on iOS, EncryptedSharedPreferences or the Android Keystore on Android, and expo-secure-store or react-native-keychain in React Native."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function tokenStorageLines(file: ChangedFile): number[] {
  if (file.tokenStorageLines !== undefined) {
    return file.tokenStorageLines;
  }
  return file.patch === undefined ? [] : findTokenStorageLines(file.path, file.patch);
}
