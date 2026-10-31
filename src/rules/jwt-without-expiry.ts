import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findJwtWithoutExpiryLines } from "../security/jwt-expiry.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;

export const jwtWithoutExpiryRule: Rule = {
  id: "jwt-without-expiry",
  description: "Flags JSON Web Tokens issued without an expiry.",
  run({ files, config }) {
    if (!config.rules.jwtWithoutExpiry.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = jwtExpiryLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "jwt-without-expiry",
          title: "JWT issued without an expiry",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "issue JSON Web Tokens" : "issues a JSON Web Token"} without an expiry, so a token that leaks, through a log, a browser, or a former employee, works for as long as the signing key does, and cannot be revoked without changing it.`,
          recommendation:
            "Give each token a short lifetime, such as `expiresIn: \"15m\"` with jsonwebtoken, `setExpirationTime(\"15m\")` with jose, or an `exp` claim, and use refresh tokens that the server can revoke for longer sessions."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function jwtExpiryLines(file: ChangedFile): number[] {
  if (file.jwtExpiryLines !== undefined) {
    return file.jwtExpiryLines;
  }
  return file.patch === undefined ? [] : findJwtWithoutExpiryLines(file.path, file.patch);
}
