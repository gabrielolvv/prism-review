import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";

type Tool = "Next.js" | "Vue CLI" | "Vite" | "Nuxt" | "webpack" | "Angular" | "Create React App";
type Found = { line: number; tool: Tool };

const nextConfig = /(?:^|\/)next\.config\.[cm]?[jt]s$/i;
const vueConfig = /(?:^|\/)vue\.config\.[cm]?[jt]s$/i;
const viteConfig = /(?:^|\/)(?:vite|vitest|svelte|astro|remix)\.config\.[cm]?[jt]s$/i;
const nuxtConfig = /(?:^|\/)nuxt\.config\.[cm]?[jt]s$/i;
const webpackConfig = /(?:^|\/)[^/]*(?:webpack|rspack)[^/]*\.[cm]?[jt]s$|(?:^|\/)(?:craco|rsbuild)\.config\.[cm]?[jt]s$/i;
const angularConfig = /(?:^|\/)angular\.json$/i;
const environmentFile = /(?:^|\/)(?:\.env\.production(?:\.local)?|Dockerfile[^/]*|Containerfile|[^/]+\.ya?ml|[^/]+\.sh|netlify\.toml|vercel\.json|package\.json)$/i;

// Development, test, and documentation setups, which never reach users, and Storybook's own build.
const ciOrTestSetup =
  /(?:^|[\/_.-])(?:e2e|integ|tests?|testing|spec|karma|jest|vitest|fixtures?|examples?|samples?|demos?|playground|storybook|dev|development|local|hot|watch|docs?)(?:[\/_.-]|$)|(?:^|\/)(?:hack|\.storybook)\//i;
const commentLine = /^\s*(?:\/\/|\*|\/\*|#)/;

// Source maps uploaded to an error tracker and then deleted, or hidden from the bundle.
const mapsKeptPrivate = /deleteSourcemapsAfterUpload|filesToDeleteAfterUpload|hideSourceMaps\s*:\s*true|deleteAfterUpload|hidden-source-map|nosources-source-map/;
// Library and server builds, whose maps are not served to browsers.
const libraryOrServerBuild = /^\s*lib\s*:\s*\{|^\s*library\s*:|\btarget\s*:\s*["'](?:node|electron-main|async-node)\w*["']|\bssr\s*:\s*true\b/m;

const devtoolSetting = /\bdevtool\s*:\s*(.+)$/;
const fullSourceMap = /["'](?!hidden|nosources)(?:eval-|inline-|cheap-|module-)*source-map["']/;

// Enclosing blocks and conditions for development servers, previews, and tests.
const developmentBlock = /\bif\s*\([^)]*(?:dev|watch|serve|hot|local|!\s*\w*prod)|\b(?:devServer|livePreview|preview|server|test|optimizeDeps)\s*[:(]/i;

// The lines that enclose the one at `index`, found by smaller indentation.
function ancestors(lines: PatchLine[], index: number): string[] {
  let indent = /^\s*/.exec(lines[index]?.content ?? "")?.[0].length ?? 0;
  const found: string[] = [];
  for (let position = index - 1; position >= Math.max(0, index - 120) && indent > 0; position -= 1) {
    const content = lines[position]?.content ?? "";
    if (content.trim() === "") {
      continue;
    }
    const own = /^\s*/.exec(content)?.[0].length ?? 0;
    if (own < indent) {
      found.push(content);
      indent = own;
    }
  }
  return found;
}

// The value webpack's `devtool` takes in production: the matching branch of a condition, or the value itself.
function productionDevtool(value: string): string | undefined {
  const ternary = /^([^?]+)\?\s*([^:]+?)\s*:\s*([^,}]+)/.exec(value);
  if (ternary === null) {
    return value;
  }
  const condition = ternary[1] ?? "";
  if (/prod/i.test(condition)) {
    return /!\s*\w*prod|!==?\s*["']production["']/i.test(condition) ? ternary[3] : ternary[2];
  }
  if (/dev|local|watch|serve/i.test(condition)) {
    return /!\s*\w*dev|!==?\s*["']development["']/i.test(condition) ? ternary[2] : ternary[3];
  }
  return undefined;
}

function angularProduction(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  let depth = 0;
  let productionDepth: number | undefined;
  lines.forEach(({ line, content, added }, index) => {
    if (productionDepth === undefined && /"production"\s*:\s*\{/.test(content)) {
      productionDepth = depth;
    }
    if (productionDepth !== undefined && added) {
      const inline = /"sourceMap"\s*:\s*true\b/.test(content);
      const scripts = /"sourceMap"\s*:\s*\{/.test(content) && /"scripts"\s*:\s*true/.test(lines.slice(index, index + 6).map(({ content: text }) => text).join(" "));
      const hidden = /"hidden"\s*:\s*true/.test(lines.slice(index, index + 6).map(({ content: text }) => text).join(" "));
      if (inline || (scripts && !hidden)) {
        found.push({ line, tool: "Angular" });
      }
    }
    depth += (content.match(/\{/g)?.length ?? 0) - (content.match(/\}/g)?.length ?? 0);
    if (productionDepth !== undefined && depth <= productionDepth) {
      productionDepth = undefined;
    }
  });
  return found;
}

function settings(path: string, lines: PatchLine[]): Found[] {
  const text = lines.map(({ content }) => content).join("\n");
  if (mapsKeptPrivate.test(text)) {
    return [];
  }
  if (angularConfig.test(path)) {
    return angularProduction(lines);
  }
  const found: Found[] = [];
  const library = libraryOrServerBuild.test(text);
  // A webpack file fixed to development mode, such as `mode: 'development'`.
  const developmentOnly = /\bmode\s*:\s*["']development["']/.test(text) && !/["']production["']/.test(text);
  lines.forEach(({ line, content, added }, index) => {
    if (!added || commentLine.test(content)) {
      return;
    }
    const enclosing = ancestors(lines, index);
    if (enclosing.some((text) => developmentBlock.test(text))) {
      return;
    }
    if (nextConfig.test(path) && /\bproductionBrowserSourceMaps\s*:\s*true\b/.test(content)) {
      found.push({ line, tool: "Next.js" });
    } else if (vueConfig.test(path) && /\bproductionSourceMap\s*:\s*true\b/.test(content)) {
      found.push({ line, tool: "Vue CLI" });
    } else if (viteConfig.test(path) && !library && /^\s*sourcemap\s*:\s*(?:true\b|["']inline["'])/.test(content)) {
      found.push({ line, tool: "Vite" });
    } else if (nuxtConfig.test(path) && /^\s*(?:sourcemap\s*:\s*true\b|client\s*:\s*true\b)/.test(content) && /\bsourcemap\b/.test(text)) {
      found.push({ line, tool: "Nuxt" });
    } else if (webpackConfig.test(path) && !library && !developmentOnly) {
      const value = devtoolSetting.exec(content)?.[1];
      const production = value === undefined ? undefined : productionDevtool(value);
      if (production !== undefined && fullSourceMap.test(production)) {
        found.push({ line, tool: "webpack" });
      }
    } else if (environmentFile.test(path) && /\bGENERATE_SOURCEMAP\s*[=:]\s*["']?true\b/.test(content)) {
      found.push({ line, tool: "Create React App" });
    }
  });
  return found;
}

export const productionSourceMapRule: Rule = {
  id: "production-source-map",
  description:
    "Warns about production web builds that publish source maps, which hand anyone the application's original source: Next.js `productionBrowserSourceMaps`, Vue CLI `productionSourceMap`, Vite and Nuxt `sourcemap`, webpack's `devtool`, Angular's production `sourceMap`, and `GENERATE_SOURCEMAP=true`.",
  run({ files, config }) {
    if (!config.rules.productionSourceMap.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const configFile = [nextConfig, vueConfig, viteConfig, nuxtConfig, webpackConfig, angularConfig, environmentFile].some((pattern) => pattern.test(file.path));
      if (
        !configFile ||
        file.patch === undefined ||
        /(?:^|\/)node_modules\//.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = settings(file.path, patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lineNumbers);
      const tools = [...new Set(found.map(({ tool }) => tool))];
      return [
        {
          ruleId: "production-source-map",
          title: "Source maps published with the production build",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "turn" : "turns"} on ${listOf(tools)} source maps for the production build. Served next to the bundle, they give anyone the application's original source, with its comments, internal routes and API endpoints, feature flags, and any key left in client code.`,
          recommendation:
            "Leave source maps off for production, or build them hidden (`sourcemap: 'hidden'`, `hidden-source-map`, Angular's `hidden: true`) and upload them to your error tracker, then delete them before deploying, as the Sentry plugins do with `filesToDeleteAfterUpload`."
        }
      ];
    });
  }
};
