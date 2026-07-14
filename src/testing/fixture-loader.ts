import { readFileSync } from "node:fs";
import { parseUnifiedDiff } from "./parse-unified-diff.js";

export function loadDiffFixture(path: string) {
  return parseUnifiedDiff(readFileSync(path, "utf8"));
}
