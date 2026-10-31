import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findPublicSecretLines } from "../security/public-env-secrets.js";
import { describeLines } from "./line-list.js";

export const publicEnvSecretRule: Rule = {
  id: "public-env-secret",
  description: "Flags secrets in environment variables that the build sends to browsers, such as NEXT_PUBLIC_ and VITE_ variables and Next.js env or Vite define settings.",
  run({ files, config }) {
    if (!config.rules.publicEnvSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (file.patch === undefined || isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = publicSecretLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "public-env-secret",
          title: "Secret sent to browsers",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "put secrets" : "puts a secret"} in an environment variable that the build copies into the JavaScript it sends to browsers, where anyone who opens the site can read ${plural ? "them" : "it"}.`,
          recommendation:
            "Drop the public prefix and read the secret only in server code, such as an API route, a server action, or a backend function, and rotate any value that has already been built into a deployed bundle. Keep public variables for values meant to be public, such as publishable keys and URLs."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function publicSecretLines(file: ChangedFile): number[] {
  if (file.publicSecretLines !== undefined) {
    return file.publicSecretLines;
  }
  return file.patch === undefined ? [] : findPublicSecretLines(file.path, file.patch);
}
