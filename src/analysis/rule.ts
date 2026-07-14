import type { PrismConfig } from "../config/schema.js";
import type { ChangedFile } from "./changed-file.js";
import type { Finding } from "./finding.js";

export type AnalysisContext = {
  files: ChangedFile[];
  config: PrismConfig;
};

export type Rule = {
  id: string;
  description: string;
  run(context: AnalysisContext): Finding[];
};
