import type { ChangedFile } from "../analysis/changed-file.js";
import type { PrismConfig } from "../config/schema.js";
import { limitPatchSizes } from "./limit-patches.js";
import { redactChangedFiles } from "./redact-secrets.js";

// Size limits run first so redaction never scans unbounded input.
export function prepareChangedFiles(files: ChangedFile[], config: PrismConfig): ChangedFile[] {
  const { maxPatchBytes, redaction } = config.security;
  const allowlist = redaction.allowlist.map((source) => new RegExp(source));

  return redactChangedFiles(limitPatchSizes(files, maxPatchBytes), { allowlist });
}
