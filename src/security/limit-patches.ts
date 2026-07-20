import type { ChangedFile } from "../analysis/changed-file.js";

export function limitPatchSizes(files: ChangedFile[], maxPatchBytes: number): ChangedFile[] {
  return files.map((file) => {
    if (file.patch === undefined || Buffer.byteLength(file.patch, "utf8") <= maxPatchBytes) {
      return { ...file };
    }

    return { ...file, patch: undefined, patchOmitted: true };
  });
}
