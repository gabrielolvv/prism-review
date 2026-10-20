import type { PrismConfig } from "../config/schema.js";
import type { ChangedFile } from "./changed-file.js";
import type { Finding } from "./finding.js";

export type AnalysisContext = {
  files: ChangedFile[];
  config: PrismConfig;
  configPath: string;
  // How many files the pull request changes, when the caller knows; GitHub may return fewer.
  expectedFileCount?: number;
};

export type Rule = {
  id: string;
  description: string;
  // Security rules see files matched by `ignorePaths` too, so a path setting cannot hide them.
  seesIgnoredFiles?: boolean;
  run(context: AnalysisContext): Finding[];
};
