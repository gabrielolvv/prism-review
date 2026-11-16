import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findCiConfigSecretLines, type CiSecretLine } from "../security/ci-config-secrets.js";
import { describeLines, listOf } from "./line-list.js";

// Example, sample, demo, and fixture pipelines. Paths that name CI are what this rule reads.
const examplePath = /(?:^|[\/_.-])(?:examples?|samples?|demos?|fixtures?|testdata|mocks?)(?:[\/_.-]|$)|(?:^|\/)docs?\//i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxNames = 5;

export const ciConfigSecretRule: Rule = {
  id: "ci-config-secret",
  description: "Flags tokens, passwords, and keys written into CI pipelines instead of read from the CI's secrets, such as a token in a GitHub Actions workflow's `env:`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.ciConfigSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        examplePath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = secretLines(file);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const names = [...new Set(found.map(({ name }) => `\`${name}\``))];
      const named = names.length > maxNames ? [...names.slice(0, maxNames), `${names.length - maxNames} others`] : names;
      return [
        {
          ruleId: "ci-config-secret",
          title: "Secret written into a CI pipeline",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "write" : "writes"} ${listOf(named)} into the CI pipeline in plain text instead of reading ${names.length > 1 ? "them" : "it"} from the CI's secrets, so the ${names.length > 1 ? "values are" : "value is"} committed to the repository, where anyone who can read it, a fork, or its history can use ${names.length > 1 ? "them" : "it"}, and the CI cannot mask ${names.length > 1 ? "them" : "it"} in its logs.`,
          recommendation:
            "Rotate the values, then store them in the CI's secrets and read them from there: `${{ secrets.NAME }}` in GitHub Actions, masked and protected variables in GitLab, contexts in CircleCI, secret variables or variable groups in Azure Pipelines, `credentials()` in Jenkins, and `from_secret` in Drone and Woodpecker."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLines(file: ChangedFile): CiSecretLine[] {
  if (file.ciConfigSecretLines !== undefined) {
    return file.ciConfigSecretLines;
  }
  return file.patch === undefined ? [] : findCiConfigSecretLines(file.path, file.patch);
}
