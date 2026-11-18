import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { productionSourceMapRule } from "../../src/rules/production-source-map.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return productionSourceMapRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testProductionSourceMapReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("web/vite.config.ts", ["export default defineConfig({", "  plugins: [react()],", "  build: {", "    outDir: 'dist',", "    sourcemap: true,", "  },", "})"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Source maps published with the production build");
  assert.deepEqual(finding?.lines, [5]);
  assert.equal(
    finding?.message,
    "Line 5 turns on Vite source maps for the production build. Served next to the bundle, they give anyone the application's original source, with its comments, internal routes and API endpoints, feature flags, and any key left in client code."
  );
}

export function testProductionSourceMapReadsEachTool(): void {
  const cases: Array<[string, string[]]> = [
    ["next.config.mjs", ["const nextConfig = {", "  productionBrowserSourceMaps: true,", "}"]],
    ["frontend/vue.config.js", ["module.exports = {", "  productionSourceMap: true,", "}"]],
    ["nuxt.config.ts", ["export default defineNuxtConfig({", "  sourcemap: {", "    client: true,", "  },", "})"]],
    // webpack, directly, in a production file, and through a condition.
    ["webpack.config.js", ["module.exports = {", "  mode: 'production',", "  devtool: 'source-map',", "}"]],
    ["config/webpack.prod.js", ["  devtool: 'cheap-module-source-map',"]],
    ["webpack.config.js", ["  devtool: isProduction ? 'source-map' : 'eval',"]],
    ["webpack.config.js", ["  devtool: isDevelopment ? 'eval-cheap-module-source-map' : 'source-map',"]],
    // Angular's production configuration.
    ["angular.json", ["{", "  \"configurations\": {", "    \"production\": {", "      \"optimization\": true,", "      \"sourceMap\": true", "    }", "  }", "}"]],
    // Create React App, from its environment file and a Dockerfile.
    [".env.production", ["GENERATE_SOURCEMAP=true"]],
    ["Dockerfile", ["ENV GENERATE_SOURCEMAP=true", "RUN npm run build"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testProductionSourceMapSkipsHiddenDevelopmentAndLibraryMaps(): void {
  const cases: Array<[string, string[]]> = [
    // Hidden maps, and maps uploaded and then deleted.
    ["vite.config.ts", ["  build: {", "    sourcemap: 'hidden',", "  },"]],
    ["webpack.config.js", ["  devtool: 'hidden-source-map',"]],
    ["vite.config.ts", ["  build: { sourcemap: true },", "  plugins: [sentryVitePlugin({ sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] } })],"]],
    ["angular.json", ["    \"production\": {", "      \"sourceMap\": {", "        \"scripts\": true,", "        \"hidden\": true", "      }", "    },"]],
    // Development settings and files.
    ["webpack.config.js", ["  devtool: isProduction ? false : 'eval-source-map',"]],
    ["webpack.config.js", ["  mode: 'development',", "  devtool: 'inline-source-map',"]],
    ["webpack.dev.js", ["  devtool: 'source-map',"]],
    ["angular.json", ["    \"development\": {", "      \"sourceMap\": true", "    },"]],
    // Library and server builds, and source maps turned off.
    ["vite.config.ts", ["  build: {", "    lib: {", "      entry: 'src/index.ts',", "    },", "    sourcemap: true,", "  },"]],
    ["webpack.server.js", ["  target: 'node',", "  devtool: 'source-map',"]],
    ["next.config.js", ["  productionBrowserSourceMaps: false,"]],
    [".env.production", ["GENERATE_SOURCEMAP=false"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testProductionSourceMapSkipsTestsAndCanBeDisabled(): void {
  const lines = ["  build: { sourcemap: true },"];
  assert.deepEqual(findings([added("examples/app/vite.config.ts", lines)]), []);
  assert.deepEqual(findings([added(".storybook/vite.config.ts", lines)]), []);
  assert.deepEqual(findings([added("e2e/vite.config.ts", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { productionSourceMap: { enabled: false } } });
  assert.deepEqual(findings([added("vite.config.ts", ["    sourcemap: true,"])], config), []);
}
