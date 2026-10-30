import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findUrlCredentialLines } from "../security/url-credentials.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;

export const urlCredentialsRule: Rule = {
  id: "url-credentials",
  seesIgnoredFiles: true,
  description: "Flags URLs with a password in them, such as database connection strings.",
  run({ files, config }) {
    if (!config.rules.urlCredentials.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;
    const allowlist = config.security.redaction.allowlist.map((source) => new RegExp(source));

    return files.flatMap((file) => {
      if (documentation.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = urlCredentialLines(file, allowlist);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "url-credentials",
          title: "Password in a URL",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "add URLs" : "adds a URL"} with a password in ${plural ? "them" : "it"}, such as a database connection string, so anyone who can read the repository can use ${plural ? "those passwords" : "the password"}. ${plural ? "The passwords are" : "The password is"} redacted from this review.`,
          recommendation:
            "Treat the password as exposed: change it, and build the URL at run time from an environment variable or a secret store, such as `DATABASE_URL`. If it is a known test value, add a pattern for it to security.redaction.allowlist."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function urlCredentialLines(file: ChangedFile, allowlist: RegExp[]): number[] {
  if (file.urlCredentialLines !== undefined) {
    return file.urlCredentialLines;
  }
  return file.patch === undefined ? [] : findUrlCredentialLines(file.path, file.patch, allowlist);
}
