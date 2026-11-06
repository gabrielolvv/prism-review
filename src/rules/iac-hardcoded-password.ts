import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findIacPasswordLines, type IacPasswordLine } from "../security/iac-passwords.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// CI pipelines, end-to-end and integration test setups, Molecule scenarios, quick starts, playgrounds,
// proofs of concept, and design notes, which start services with known values.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e\w*|integ\w*|fixtures?|testdata|mocks?|quick-?start|getting-?started|playground|poc|design)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|molecule|\.github|\.gitlab|\.circleci|\.buildkite|\.devcontainer|\.tekton|\.woodpecker)\/|(?:^|\/)(?:appveyor|\.travis|\.gitlab-ci|azure-pipelines|bitbucket-pipelines|\.drone|\.woodpecker|codefresh)[^/]*\.ya?ml$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxNames = 5;

export const iacHardcodedPasswordRule: Rule = {
  id: "iac-hardcoded-password",
  description: "Flags passwords, tokens, and keys written into Terraform, CloudFormation, and Ansible inventories, such as an RDS `password` or a parameter's `Default`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.iacHardcodedPassword.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test infrastructure.
        developmentPath.test(file.path) ||
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
          ruleId: "iac-hardcoded-password",
          title: "Password written into infrastructure code",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "write" : "writes"} ${listOf(named)} into infrastructure code in plain text, so the ${names.length > 1 ? "values are" : "value is"} committed to the repository, where anyone who can read it, a fork, or its history can use ${names.length > 1 ? "them" : "it"}, and ${names.length > 1 ? "stay" : "stays"} the same in every environment built from it.`,
          recommendation:
            "Rotate the values, then supply them at deploy time: a Terraform variable marked `sensitive` with no default, filled from a secret store or a `TF_VAR_` environment variable, `random_password` or RDS's `manage_master_user_password`, a CloudFormation dynamic reference such as `{{resolve:secretsmanager:...}}`, or Ansible Vault for inventory variables."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLines(file: ChangedFile): IacPasswordLine[] {
  if (file.iacPasswordLines !== undefined) {
    return file.iacPasswordLines;
  }
  return file.patch === undefined ? [] : findIacPasswordLines(file.path, file.patch);
}
