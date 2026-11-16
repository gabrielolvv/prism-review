import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findAppConfigSecretLines, type ConfigSecretLine } from "../security/app-config-secrets.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// CI pipelines, end-to-end and integration test setups, Molecule scenarios, quick starts, playgrounds,
// proofs of concept, and design notes, which start services with known values.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e\w*|integ\w*|fixtures?|testdata|mocks?|quick-?start|getting-?started|playground|poc|design)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|molecule|\.github|\.gitlab|\.circleci|\.buildkite|\.devcontainer|\.tekton|\.woodpecker)\/|(?:^|\/)(?:appveyor|\.travis|\.gitlab-ci|azure-pipelines|bitbucket-pipelines|\.drone|\.woodpecker|codefresh)[^/]*\.ya?ml$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxNames = 5;

export const appConfigSecretRule: Rule = {
  id: "app-config-secret",
  description: "Flags passwords, tokens, and keys written into an application's configuration, such as Spring Boot's `spring.datasource.password` or a connection string's `Password=`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.appConfigSecret.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test settings.
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
          ruleId: "app-config-secret",
          title: "Password written into the app's configuration",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "write" : "writes"} ${listOf(named)} into the app's configuration in plain text, so the ${names.length > 1 ? "values are" : "value is"} committed to the repository, where anyone who can read it, a fork, or its history can use ${names.length > 1 ? "them" : "it"}, and every environment that reads this file ${names.length > 1 ? "shares them" : "shares it"}.`,
          recommendation:
            "Rotate the values, then read them from the environment or a secret store: Spring's `${DB_PASSWORD}` placeholders or Spring Cloud Vault, .NET user secrets, environment variables, or Key Vault, `os.environ` in Django, `<%= ENV[\"DB_PASSWORD\"] %>` or encrypted credentials in Rails, `env(\"DB_PASSWORD\")` without a default in Laravel, and environment variables with node-config."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLines(file: ChangedFile): ConfigSecretLine[] {
  if (file.appConfigSecretLines !== undefined) {
    return file.appConfigSecretLines;
  }
  return file.patch === undefined ? [] : findAppConfigSecretLines(file.path, file.patch);
}
