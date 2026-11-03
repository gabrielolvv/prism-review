import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findLongSessionLines } from "../security/session-lifetime.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

export const longSessionRule: Rule = {
  id: "long-session",
  description: "Flags sessions and access tokens that last longer than 30 days.",
  run({ files, config }) {
    if (!config.rules.longSession.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        // Development, example, and test apps keep sessions long on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = longSessionLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "long-session",
          title: "Session lasts too long",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "give sessions or access tokens" : "gives a session or an access token"} a lifetime longer than 30 days, so one that is stolen, from a log, a shared computer, or a cross-site scripting bug, keeps working that long, and a JSON Web Token cannot be revoked before it expires.`,
          recommendation:
            "Keep access tokens short, minutes to hours, and sessions to days, and use refresh tokens that the server can revoke, or a separate \"remember me\" token, for longer logins. Expire sessions after a period of inactivity too."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function longSessionLines(file: ChangedFile): number[] {
  if (file.longSessionLines !== undefined) {
    return file.longSessionLines;
  }
  return file.patch === undefined ? [] : findLongSessionLines(file.path, file.patch);
}
