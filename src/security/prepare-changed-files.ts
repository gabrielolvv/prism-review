import type { ChangedFile } from "../analysis/changed-file.js";
import type { PrismConfig } from "../config/schema.js";
import { findHiddenLines } from "../analysis/hidden-characters.js";
import { credentialFileKind, findCredentialLines } from "./credential-files.js";
import { detectSecrets } from "./detect-secrets.js";
import { findJwtWithoutExpiryLines } from "./jwt-expiry.js";
import { findJwtKeyLines } from "./jwt-keys.js";
import { findSecretLogLines } from "./secret-logs.js";
import { findSessionSecretLines } from "./session-secrets.js";
import { findUrlCredentialLines } from "./url-credentials.js";
import { findTimingCompareLines } from "./timing-compare.js";
import { findPublicSecretLines } from "./public-env-secrets.js";
import { findLockfileSources, isSourceFile } from "./lockfile-sources.js";
import { limitPatchSizes } from "./limit-patches.js";
import { redactChangedFiles } from "./redact-secrets.js";

// Secret detection runs first, on the full patch: a credential in an oversized file is still a
// leak, and its patterns run in linear time. Size limits then run before redaction, whose broader
// patterns should never scan unbounded input, and redaction replaces the values detection needs.
export function prepareChangedFiles(files: ChangedFile[], config: PrismConfig): ChangedFile[] {
  const { maxPatchBytes, redaction } = config.security;
  const allowlist = redaction.allowlist.map((source) => new RegExp(source));

  // Hidden characters are found the same way, so a large file cannot hide a Trojan Source edit.
  const scanned = detectSecrets(files, allowlist).map((file) => ({
    ...file,
    hiddenLines: file.patch === undefined ? [] : findHiddenLines(file.patch),
    // Redaction rewrites lines such as `const token = jwt.sign(...)`, so keys are found first.
    jwtKeyLines: file.patch === undefined ? [] : findJwtKeyLines(file.path, file.patch),
    sessionSecretLines: file.patch === undefined ? [] : findSessionSecretLines(file.path, file.patch),
    jwtExpiryLines: file.patch === undefined ? [] : findJwtWithoutExpiryLines(file.path, file.patch),
    publicSecretLines: file.patch === undefined ? [] : findPublicSecretLines(file.path, file.patch),
    secretLogLines: file.patch === undefined ? [] : findSecretLogLines(file.path, file.patch),
    urlCredentialLines: file.patch === undefined ? [] : findUrlCredentialLines(file.path, file.patch, allowlist),
    timingCompareLines: file.patch === undefined ? [] : findTimingCompareLines(file.path, file.patch),
    ...(file.patch !== undefined && credentialFileKind(file.path)?.checksLines
      ? { credentialLines: findCredentialLines(file.path, file.patch) }
      : {}),
    ...(file.patch !== undefined && isSourceFile(file.path)
      ? { lockfileSources: findLockfileSources(file.path, file.patch, config.rules.lockfileSources.allowedSources) }
      : {})
  }));
  const limited = limitPatchSizes(scanned, maxPatchBytes);
  return redactChangedFiles(limited, { allowlist });
}
