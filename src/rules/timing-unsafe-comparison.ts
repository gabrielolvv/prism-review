import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findTimingCompareLines } from "../security/timing-compare.js";
import { describeLines } from "./line-list.js";

export const timingUnsafeComparisonRule: Rule = {
  id: "timing-unsafe-comparison",
  description: "Flags signatures, tokens, and keys compared with an operator that stops at the first difference.",
  run({ files, config }) {
    if (!config.rules.timingUnsafeComparison.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (isTestDataPath(file.path) || testGlobs.some((glob) => minimatch(file.path, glob))) {
        return [];
      }

      const lines = timingCompareLines(file);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "timing-unsafe-comparison",
          title: "Secret compared in variable time",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compare" : "compares"} what looks like a signature, token, or key with an operator that stops at the first difference, so how long the check takes can reveal the expected value one character at a time.`,
          recommendation:
            "Compare secrets in constant time: crypto.timingSafeEqual in Node.js, hmac.compare_digest in Python, ActiveSupport::SecurityUtils.secure_compare in Ruby, subtle.ConstantTimeCompare in Go, MessageDigest.isEqual in Java, CryptographicOperations.FixedTimeEquals in .NET, or hash_equals in PHP."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function timingCompareLines(file: ChangedFile): number[] {
  if (file.timingCompareLines !== undefined) {
    return file.timingCompareLines;
  }
  return file.patch === undefined ? [] : findTimingCompareLines(file.path, file.patch);
}
