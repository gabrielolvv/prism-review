import type { ChangedFile } from "../analysis/changed-file.js";
import type { PrismConfig } from "../config/schema.js";
import { detectSecrets } from "./detect-secrets.js";
import { limitPatchSizes } from "./limit-patches.js";
import { redactChangedFiles } from "./redact-secrets.js";

// Size limits run first so no pattern ever scans unbounded input. Detection runs before
// redaction, which replaces the values it looks for.
export function prepareChangedFiles(files: ChangedFile[], config: PrismConfig): ChangedFile[] {
  const { maxPatchBytes, redaction } = config.security;
  const allowlist = redaction.allowlist.map((source) => new RegExp(source));

  const limited = limitPatchSizes(files, maxPatchBytes);
  return redactChangedFiles(detectSecrets(limited, allowlist), { allowlist });
}
