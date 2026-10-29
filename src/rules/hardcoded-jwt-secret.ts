import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findJwtKeyLines } from "../security/jwt-keys.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;

export const hardcodedJwtSecretRule: Rule = {
  id: "hardcoded-jwt-secret",
  description: "Flags JSON Web Tokens signed or verified with a key written in the code.",
  run({ files, config }) {
    if (!config.rules.hardcodedJwtSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (documentation.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = jwtKeyLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "hardcoded-jwt-secret",
          title: "JWT key written in the code",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "sign or verify" : "signs or verifies"} JSON Web Tokens with a key written in the code, so anyone who can read the code can make tokens the application accepts.`,
          recommendation:
            "Load the key from a secret store or an environment variable, and replace the key that was committed. When other services only verify tokens, an asymmetric algorithm such as RS256 or EdDSA lets them do it without the signing key."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function jwtKeyLines(file: ChangedFile): number[] {
  if (file.jwtKeyLines !== undefined) {
    return file.jwtKeyLines;
  }
  return file.patch === undefined ? [] : findJwtKeyLines(file.path, file.patch);
}
