import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findDeploymentEnvSecretLines, type EnvSecretLine } from "../security/deployment-env-secrets.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// CI pipelines, end-to-end and integration test setups, Molecule scenarios, quick starts, playgrounds,
// proofs of concept, and design notes, which start services with known values.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e\w*|integ\w*|fixtures?|testdata|mocks?|quick-?start|getting-?started|playground|poc|design)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|molecule|\.github|\.gitlab|\.circleci|\.buildkite|\.devcontainer|\.tekton|\.woodpecker)\/|(?:^|\/)(?:appveyor|\.travis|\.gitlab-ci|azure-pipelines|bitbucket-pipelines|\.drone|\.woodpecker|codefresh)[^/]*\.ya?ml$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxNames = 5;

export const deploymentEnvSecretRule: Rule = {
  id: "deployment-env-secret",
  description: "Flags passwords, tokens, and keys written in plain text into a deployment's environment, in Kubernetes, ECS, Terraform, production Compose, App Engine, and Helm values.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.deploymentEnvSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test deployments.
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
      const named = names.length > maxNames ? [...names.slice(0, maxNames), `${names.length - maxNames} other variables`] : names;
      return [
        {
          ruleId: "deployment-env-secret",
          title: "Secret written into a deployment's environment",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "write" : "writes"} ${listOf(named)} into a deployment's environment in plain text, so the ${names.length > 1 ? "secrets are" : "secret is"} committed to the repository, where anyone who can read it, a fork, or its history can use ${names.length > 1 ? "them" : "it"}, and ${names.length > 1 ? "show" : "shows"} to anyone who can read the deployment, such as with \`kubectl describe\` or in the ECS console.`,
          recommendation:
            "Rotate the values, then read them from a secret instead: Kubernetes' `valueFrom.secretKeyRef`, ECS's `secrets` with Secrets Manager or Parameter Store, Compose's `secrets`, App Engine's and Cloud Run's Secret Manager, or a Helm value passed at install time, filled from a secret store."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLines(file: ChangedFile): EnvSecretLine[] {
  if (file.deploymentEnvSecretLines !== undefined) {
    return file.deploymentEnvSecretLines;
  }
  return file.patch === undefined ? [] : findDeploymentEnvSecretLines(file.path, file.patch);
}
