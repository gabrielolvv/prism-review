import type { ChangedFile } from "../analysis/changed-file.js";
import type { Rule } from "../analysis/rule.js";
import { credentialFileKind, findCredentialLines } from "../security/credential-files.js";
import { describeLines } from "./line-list.js";

const exposure = "readable by anyone with access to the repository";
const recommendation =
  "Treat the credentials as exposed and rotate them, remove the file from the branch history, and add it to .gitignore. Commit an example file with placeholder values instead, or read the value from an environment variable such as ${NPM_TOKEN}.";

export const credentialFileRule: Rule = {
  id: "credential-file",
  description: "Flags private keys, Terraform state, and other files that hold credentials, and secrets added to .env and .npmrc files.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.credentialFiles.enabled) {
      return [];
    }

    return files.flatMap((file) => {
      const kind = file.status === "removed" ? undefined : credentialFileKind(file.path);
      if (kind === undefined || (kind.textOnly && file.patch === undefined)) {
        return [];
      }

      if (!kind.checksLines) {
        return [
          {
            ruleId: "credential-file",
            title: "Credential file committed",
            severity: "high" as const,
            file: file.path,
            message: `This is ${kind.name}, a kind of file that usually holds credentials, so they would be ${exposure}.`,
            recommendation
          }
        ];
      }

      const lines = credentialLines(file);
      if (lines.length === 0) {
        return [];
      }
      const { text, plural } = describeLines(lines);
      const what = kind.name === "an environment file" ? (plural ? "secrets" : "a secret") : plural ? "registry tokens" : "a registry token";

      return [
        {
          ruleId: "credential-file",
          title: "Credential added to a configuration file",
          severity: "high" as const,
          file: file.path,
          line: Math.min(...lines),
          message: `${text} ${plural ? "add" : "adds"} ${what} to ${kind.name}, so ${plural ? "they" : "it"} would be ${exposure}.`,
          recommendation
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function credentialLines(file: ChangedFile): number[] {
  if (file.credentialLines !== undefined) {
    return file.credentialLines;
  }
  return file.patch === undefined ? [] : findCredentialLines(file.path, file.patch);
}
