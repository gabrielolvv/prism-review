import type { ChangedFile } from "../analysis/changed-file.js";
import type { PrismConfig } from "../config/schema.js";
import { detectSecrets } from "./detect-secrets.js";
import { limitPatchSizes } from "./limit-patches.js";
import { redactChangedFiles } from "./redact-secrets.js";

// Secret detection runs first, on the full patch: a credential in an oversized file is still a
// leak, and its patterns run in linear time. Size limits then run before redaction, whose broader
// patterns should never scan unbounded input, and redaction replaces the values detection needs.
export function prepareChangedFiles(files: ChangedFile[], config: PrismConfig): ChangedFile[] {
  const { maxPatchBytes, redaction } = config.security;
  const allowlist = redaction.allowlist.map((source) => new RegExp(source));

  const limited = limitPatchSizes(detectSecrets(files, allowlist), maxPatchBytes);
  return redactChangedFiles(limited, { allowlist });
}
