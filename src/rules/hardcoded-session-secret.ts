import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findSessionSecretLines } from "../security/session-secrets.js";
import { describeLines } from "./line-list.js";

const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;
// Example and demo apps commit a key so they run as they are.
const sampleDirectory = /(?:^|\/)(?:examples?|samples?|demos?|docs?)\//i;

export const hardcodedSessionSecretRule: Rule = {
  id: "hardcoded-session-secret",
  description: "Flags session and cookie signing keys written in the code.",
  run({ files, config }) {
    if (!config.rules.hardcodedSessionSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        sampleDirectory.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = sessionSecretLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "hardcoded-session-secret",
          title: "Session key written in the code",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "set" : "sets"} the key that signs session cookies to text written in the code, so anyone who can read the code can make a cookie for any user. With Flask, Django, and Rails, which unpickle or unmarshal some signed data, that can also mean running code on the server.`,
          recommendation:
            "Load the key from a secret store or an environment variable, such as `process.env.SESSION_SECRET`, `os.environ[\"SECRET_KEY\"]`, or Rails credentials, and replace the key that was committed, which signs out every user."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function sessionSecretLines(file: ChangedFile): number[] {
  if (file.sessionSecretLines !== undefined) {
    return file.sessionSecretLines;
  }
  return file.patch === undefined ? [] : findSessionSecretLines(file.path, file.patch);
}
