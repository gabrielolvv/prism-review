import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findSecretLogLines } from "../security/secret-logs.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;

export const secretLoggingRule: Rule = {
  id: "secret-logging",
  description: "Flags log and console calls that write a password, token, API key, or other secret.",
  run({ files, config }) {
    if (!config.rules.secretLogging.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (documentation.test(file.path) || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = secretLogLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "secret-logging",
          title: "Secret written to a log",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "write" : "writes"} what looks like a password, token, or key to a log or the console, where anyone who can read the logs, or a log service, can see it.`,
          recommendation:
            "Log that the value was present or an identifier for it, never the value itself, or mask it first, for example by keeping its last four characters. Logging libraries can also redact known fields, such as pino's redact option."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLogLines(file: ChangedFile): number[] {
  if (file.secretLogLines !== undefined) {
    return file.secretLogLines;
  }
  return file.patch === undefined ? [] : findSecretLogLines(file.path, file.patch);
}
