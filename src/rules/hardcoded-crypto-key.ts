import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findCryptoKeyLines } from "../security/crypto-keys.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;

export const hardcodedCryptoKeyRule: Rule = {
  id: "hardcoded-crypto-key",
  description: "Flags encryption and MAC keys written in the code, such as createCipheriv with a text key, CryptoJS passphrases, and SecretKeySpec over a string.",
  run({ files, config }) {
    if (!config.rules.hardcodedCryptoKey.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Example, demo, and test code commits a key so it runs as it is.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = cryptoKeyLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "hardcoded-crypto-key",
          title: "Encryption key written in the code",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "encrypt or sign" : "encrypts or signs"} with a key written in the code, so anyone who can read the code, its history, or the built app can decrypt the data and forge what the key protects. The key cannot be changed without a release, and every copy of the code shares it.`,
          recommendation:
            "Load keys from a key management service or a secret store, such as AWS KMS, Google Cloud KMS, Azure Key Vault, or HashiCorp Vault, or from an environment variable the deployment sets. Replace the key that was committed and re-encrypt the data it protected."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function cryptoKeyLines(file: ChangedFile): number[] {
  if (file.cryptoKeyLines !== undefined) {
    return file.cryptoKeyLines;
  }
  return file.patch === undefined ? [] : findCryptoKeyLines(file.path, file.patch);
}
