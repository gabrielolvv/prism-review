import type { ChangedFile } from "../analysis/changed-file.js";
import type { PrismConfig } from "../config/schema.js";
import { limitPatchSizes } from "./limit-patches.js";
import { redactChangedFiles } from "./redact-secrets.js";

// Size limits run first so redaction never scans unbounded input.
export function prepareChangedFiles(files: ChangedFile[], config: PrismConfig): ChangedFile[] {
  return redactChangedFiles(limitPatchSizes(files, config.security.maxPatchBytes));
}
