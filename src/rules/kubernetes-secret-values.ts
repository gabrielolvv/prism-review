import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findKubernetesSecretLines, type KubernetesSecretLine } from "../security/kubernetes-secrets.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// CI, end-to-end and integration test setups, quick starts, and playgrounds that run with known values.
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e\w*|integ\w*|fixtures?|testdata|mocks?|quick-?start|getting-?started|playground)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|\.github)\//i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxKeys = 5;

export const kubernetesSecretValuesRule: Rule = {
  id: "kubernetes-secret-values",
  description: "Flags Kubernetes Secret manifests and Kustomize secret generators committed with passwords, tokens, or keys in `data`, `stringData`, or `literals`.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.kubernetesSecretValues.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test manifests.
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
      const keys = [...new Set(found.map(({ key }) => `\`${key}\``))];
      const named = keys.length > maxKeys ? [...keys.slice(0, maxKeys), `${keys.length - maxKeys} other keys`] : keys;
      return [
        {
          ruleId: "kubernetes-secret-values",
          title: "Kubernetes Secret committed with its values",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "put" : "puts"} values for ${listOf(named)} in a Kubernetes Secret committed to the repository. Secret data is only base64-encoded, not encrypted, so anyone who can read the repository, a fork, or its history can read these values and use them.`,
          recommendation:
            "Treat the values as exposed and rotate them. Keep Secret values out of the repository: create Secrets from a secret store with External Secrets or the Secrets Store CSI driver, encrypt them with Sealed Secrets or SOPS, or fill them in from values passed at deploy time, and commit only placeholders."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function secretLines(file: ChangedFile): KubernetesSecretLine[] {
  if (file.kubernetesSecretLines !== undefined) {
    return file.kubernetesSecretLines;
  }
  return file.patch === undefined ? [] : findKubernetesSecretLines(file.path, file.patch);
}
