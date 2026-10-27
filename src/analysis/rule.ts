import type { PrismConfig } from "../config/schema.js";
import type { ChangedFile } from "./changed-file.js";
import type { Finding } from "./finding.js";

export type AnalysisContext = {
  files: ChangedFile[];
  config: PrismConfig;
  configPath: string;
  // How many files the pull request changes, when the caller knows; GitHub may return fewer.
  expectedFileCount?: number;
  // Every path the pull request changes, old paths of renames and ignored files included.
  changedPaths: ReadonlySet<string>;
  // Lockfiles that exist on the base commit, in the directories that were checked; unknown when
  // the caller could not look.
  existingLockfiles?: ReadonlySet<string>;
};

export type Rule = {
  id: string;
  description: string;
  // Security rules see files matched by `ignorePaths` too, so a path setting cannot hide them.
  seesIgnoredFiles?: boolean;
  run(context: AnalysisContext): Finding[];
};
