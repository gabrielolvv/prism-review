import { minimatch } from "minimatch";
import type { ChangedFile } from "../analysis/changed-file.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { findConfigMapSecretLines, type ConfigMapSecretLine } from "../security/configmap-secrets.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// CI, end-to-end and integration test setups, quick starts, and playgrounds that run with known values.
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e\w*|integ\w*|fixtures?|testdata|mocks?|quick-?start|getting-?started|playground)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?|\.github)\//i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxKeys = 5;

export const configMapSecretRule: Rule = {
  id: "configmap-secret",
  description: "Flags passwords, tokens, and keys written into Kubernetes ConfigMaps and Kustomize ConfigMap generators, which more roles can read than Secrets.",
  seesIgnoredFiles: true,
  run({ files, config }) {
    if (!config.rules.configMapSecret.enabled) {
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

      const found = configMapLines(file);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const keys = [...new Set(found.map(({ key }) => `\`${key}\``))];
      const named = keys.length > maxKeys ? [...keys.slice(0, maxKeys), `${keys.length - maxKeys} other keys`] : keys;
      return [
        {
          ruleId: "configmap-secret",
          title: "Secret kept in a ConfigMap",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "put" : "puts"} values for ${listOf(named)} in a Kubernetes ConfigMap committed to the repository. Anyone who can read the repository can read them, and in the cluster ConfigMaps are readable by more roles than Secrets, such as the built-in \`view\` role, and are left out of encryption at rest.`,
          recommendation:
            "Treat the values as exposed and rotate them. Move credentials to a Secret created from a secret store with External Secrets or the Secrets Store CSI driver, or encrypted with Sealed Secrets or SOPS, and pass them to the app with `secretKeyRef` or a Secret volume, leaving only non-secret settings in the ConfigMap."
        }
      ];
    });
  }
};

// Files that skipped prepareChangedFiles still carry their original patch, so scan it here.
function configMapLines(file: ChangedFile): ConfigMapSecretLine[] {
  if (file.configMapSecretLines !== undefined) {
    return file.configMapSecretLines;
  }
  return file.patch === undefined ? [] : findConfigMapSecretLines(file.path, file.patch);
}
