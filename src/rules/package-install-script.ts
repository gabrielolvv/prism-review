import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Hook = { line: number; name: string };

const packageJson = /(?:^|\/)package\.json$/;
const setupPy = /(?:^|\/)setup\.py$/;
const vendored = /(?:^|\/)(?:node_modules|vendor|third_party)\//;

// npm, pnpm, Yarn, and Bun run these when anyone installs the package from a registry.
const installScript = /^\s*"(preinstall|install|postinstall)"\s*:\s*"((?:[^"\\]|\\.)*)"/;
// Commands that build or fetch a native addon's own binary, set up Git hooks, or only print, which
// most packages with native code run.
const usualCommand =
  /^(?:node-gyp(?:-build(?:-optional)?)?\b|prebuild-install\b|pkg-prebuilds-verify\b|(?:@mapbox\/)?node-pre-gyp\b|cmake-js\b|napi-postinstall\b|husky\b|is-ci\b|patch-package\b|opencollective(?:-postinstall)?\b|ngcc\b|echo\b|exit 0\b|true$|node-gyp rebuild\b)/;
const privatePackage = /^\s*"private"\s*:\s*true\b/;
const workspaces = /^\s*"workspaces"\s*:/;
// `cmdclass={"install": PostInstall}` and `cmdclass["install"] = PostInstall` in setup.py, which run
// code when a source distribution installs.
const installCommandClass = /\bcmdclass\s*=\s*\{[^}]*["'](install|develop|egg_info)["']\s*:|\bcmdclass\[\s*["'](install|develop|egg_info)["']\s*\]\s*=/;
const cmdclassStart = /\bcmdclass\s*=\s*\{/;
const cmdclassEntry = /^\s*["'](install|develop|egg_info)["']\s*:/;
const cmdclassWindow = 8;

function npmHooks(lines: PatchLine[]): Hook[] {
  // Private packages and workspace roots are never published, so their scripts run only for their
  // own developers.
  if (lines.some(({ content }) => privatePackage.test(content) || workspaces.test(content))) {
    return [];
  }
  return lines.flatMap(({ line, content, added }) => {
    const match = installScript.exec(content);
    if (!added || match === null) {
      return [];
    }
    // A leading `cross-env NAME=value` only sets variables for the command after it.
    const command = (match[2] ?? "").trim().replace(/^(?:cross-env\s+)?(?:[A-Z_][A-Z0-9_]*=\S*\s+)+/, "");
    return command === "" || usualCommand.test(command) ? [] : [{ line, name: match[1] ?? "" }];
  });
}

function pythonHooks(lines: PatchLine[]): Hook[] {
  return lines.flatMap(({ line, content, added }, index) => {
    if (!added || /^\s*#/.test(content)) {
      return [];
    }
    const inline = installCommandClass.exec(content);
    if (inline !== null) {
      return [{ line, name: `cmdclass ${inline[1] ?? inline[2]}` }];
    }
    // `cmdclass={` with `"install": PostInstall,` on a line below it.
    const entry = cmdclassEntry.exec(content);
    if (entry !== null && lines.slice(Math.max(0, index - cmdclassWindow), index).some(({ content: before }) => cmdclassStart.test(before))) {
      return [{ line, name: `cmdclass ${entry[1]}` }];
    }
    return [];
  });
}

export const packageInstallScriptRule: Rule = {
  id: "package-install-script",
  description:
    "Flags install scripts added to published packages, such as `postinstall` in a `package.json` that is not private and `cmdclass` install hooks in `setup.py`, which run on every machine that installs the package.",
  run({ files, config }) {
    if (!config.rules.packageInstallScript.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const npm = packageJson.test(file.path);
      if (
        (!npm && !setupPy.test(file.path)) ||
        file.patch === undefined ||
        vendored.test(file.path) ||
        // Example, sample, demo, and test packages.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found = npm ? npmHooks(lines) : pythonHooks(lines);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const names = [...new Set(found.map(({ name }) => `\`${name}\``))];
      return [
        {
          ruleId: "package-install-script",
          title: "Install script added to a published package",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "add" : "adds"} ${listOf(names)}, which ${names.length > 1 ? "run" : "runs"} code on the machine of everyone who installs this package, before they use it and with their files and credentials. Malware spreads this way, as the Shai-Hulud worm and the compromised nx releases did on npm in 2025, so a package that starts running code at install needs a reason.`,
          recommendation:
            "Do the work at first use or in an explicit setup command instead, ship prebuilt files in the package, or download native binaries through optional dependencies per platform, as esbuild does. If an install script is needed, keep it small, avoid network access, and say why in the changelog, since many installs now run with `--ignore-scripts`."
        }
      ];
    });
  }
};
