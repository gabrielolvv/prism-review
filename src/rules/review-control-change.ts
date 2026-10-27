import { codeOwnersPaths } from "../analysis/code-owners.js";
import type { ChangedFile } from "../analysis/changed-file.js";
import type { Finding } from "../analysis/finding.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const linguistAttribute = /\blinguist-(?:generated|vendored)\b/;
const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// CODEOWNERS decides who must review a path, and the linguist attributes in .gitattributes decide
// which files GitHub collapses in diffs and Prism Review leaves out. Both are read from the base
// branch, so a change to them applies to the pull requests after this one.
export const reviewControlChangeRule: Rule = {
  id: "review-control-change",
  seesIgnoredFiles: true,
  description: "Flags changes to CODEOWNERS and to the files .gitattributes marks generated or vendored.",
  run({ files }) {
    return files.flatMap((file) => {
      const paths = [file.path, file.previousPath].filter((path): path is string => path !== undefined);
      if (paths.some((path) => codeOwnersPaths.includes(path))) {
        return [codeOwnersFinding(file)];
      }
      if (paths.some((path) => path === ".gitattributes" || path.endsWith("/.gitattributes"))) {
        return gitAttributesFindings(file);
      }
      return [];
    });
  }
};

function codeOwnersFinding(file: ChangedFile): Finding {
  return {
    ruleId: "review-control-change",
    title: "Code owners changed",
    severity: "warning",
    file: file.path,
    message:
      file.status === "removed"
        ? "This pull request removes a CODEOWNERS file, so later pull requests no longer require reviews from the owners it named."
        : "This pull request changes CODEOWNERS, which decides whose review later pull requests require for each path.",
    recommendation: "Have the current owners of the affected paths approve the change, and check that no path lost its owner."
  };
}

function gitAttributesFindings(file: ChangedFile): Finding[] {
  // Without a patch, as for one over the size limit, the change cannot be checked line by line.
  if (file.patch === undefined) {
    return [gitAttributesFinding(file, "This .gitattributes change could not be inspected, so it may change", [])];
  }

  const { touched, added } = linguistChanges(file.patch);
  if (!touched) {
    return [];
  }
  if (added.length === 0) {
    return [gitAttributesFinding(file, "This change removes lines that set", [])];
  }
  const { text, plural } = describeLines(added);
  return [gitAttributesFinding(file, `${text} ${plural ? "change" : "changes"}`, added)];
}

function gitAttributesFinding(file: ChangedFile, opening: string, lines: number[]): Finding {
  return {
    ruleId: "review-control-change",
    title: "Generated file markers changed",
    severity: "warning",
    file: file.path,
    ...(lines.length > 0 ? { line: Math.min(...lines), lines } : {}),
    message: `${opening} which files are marked linguist-generated or linguist-vendored. GitHub collapses those files in diffs and Prism Review leaves them out of its noise rules, so the change affects how later pull requests are reviewed.`,
    recommendation: "Check that only generated or third-party files are marked, and that no source directory is."
  };
}

// Added and removed lines that mention a linguist attribute, with the added ones numbered as in
// the new file.
function linguistChanges(patch: string): { touched: boolean; added: number[] } {
  const added: number[] = [];
  let touched = false;
  let newLine: number | undefined;

  for (const line of patch.split(/\r?\n/)) {
    const header = hunkHeader.exec(line);
    if (header) {
      newLine = Number(header[1]);
      continue;
    }
    if (newLine === undefined || line.startsWith("\\")) {
      continue;
    }
    if (line.startsWith("-")) {
      touched ||= linguistAttribute.test(line);
      continue;
    }
    if (line.startsWith("+") && linguistAttribute.test(line)) {
      touched = true;
      added.push(newLine);
    }
    newLine += 1;
  }

  return { touched, added };
}
