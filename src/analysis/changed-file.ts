import type { LockfileSource } from "../security/lockfile-sources.js";
import type { HiddenLine } from "./hidden-characters.js";

// GitHub lists at most this many files for a pull request.
export const pullRequestFileLimit = 3000;

export type FileStatus = "added" | "modified" | "removed" | "renamed";

export type ChangedFile = {
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
  patchOmitted?: boolean;
  // Set by prepareChangedFiles, which scans the patch before redaction.
  secrets?: SecretMatch[];
  // Set by prepareChangedFiles before oversized patches are dropped.
  hiddenLines?: HiddenLine[];
  // Set by prepareChangedFiles before redaction, for environment and package manager files.
  credentialLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction, for lockfiles and registry settings.
  lockfileSources?: LockfileSource[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that sign or verify
  // a JSON Web Token with a key written in the code.
  jwtKeyLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that set a session
  // or cookie signing key to text written in the code.
  sessionSecretLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that issue a JSON
  // Web Token without an expiry.
  jwtExpiryLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that name a secret
  // in a variable the build sends to browsers.
  publicSecretLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that log a value
  // named like a secret.
  secretLogLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that hold a URL
  // with a password in it.
  urlCredentialLines?: number[];
  // Set by prepareChangedFiles before the size limit and redaction: added lines that compare a
  // signature, token, or key in variable time.
  timingCompareLines?: number[];
};

// A credential found on an added line, numbered as in the new version of the file.
export type SecretMatch = {
  line: number;
  kind: string;
};

export function changedLines(file: ChangedFile): number {
  return file.additions + file.deletions;
}
