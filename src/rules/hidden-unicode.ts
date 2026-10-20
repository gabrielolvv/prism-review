import { findHiddenCharacters, findHiddenLines } from "../analysis/hidden-characters.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const effect = "characters that are invisible or reorder text";

export const hiddenUnicodeRule: Rule = {
  id: "hidden-unicode",
  seesIgnoredFiles: true,
  description: "Flags added bidirectional controls and invisible characters that hide or reorder text.",
  run({ files, config }) {
    if (!config.rules.hiddenUnicode.enabled) {
      return [];
    }

    return files.flatMap((file) => {
      const inPath = findHiddenCharacters(file.path);
      // Prepared files carry the scan of their full patch; others are scanned here.
      const inLines = (file.hiddenLines ?? findHiddenLines(file.patch ?? "")).map((found) => ({
        line: found.line,
        found
      }));

      if (inPath.labels.length === 0 && inLines.length === 0) {
        return [];
      }

      const sentences: string[] = [];
      if (inPath.labels.length > 0) {
        sentences.push(
          `The file name contains ${effect} (${inPath.labels.join(", ")}), so it can display as a different name.`
        );
      }

      if (inLines.length > 0) {
        const { text, plural } = describeLines(inLines.map(({ line }) => line));
        const labels = [...new Set(inLines.flatMap(({ found }) => found.labels))];
        sentences.push(
          `${text} ${plural ? "contain" : "contains"} ${effect} (${labels.join(", ")}), so the code can read differently from how it runs.`
        );
      }

      const reordersText = inPath.reordersText || inLines.some(({ found }) => found.reordersText);

      return [
        {
          ruleId: "hidden-unicode",
          title: "Hidden Unicode characters added",
          severity: reordersText ? ("high" as const) : ("warning" as const),
          file: file.path,
          ...(inLines.length > 0 ? { line: Math.min(...inLines.map(({ line }) => line)) } : {}),
          message: sentences.join(" "),
          recommendation:
            "Remove the characters, or write them as escape sequences if they are intended, and check the change in an editor that shows control characters."
        }
      ];
    });
  }
};
