import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// GitHub runs the action straight from the repository checkout, without
// installing dependencies, so every entry point ships as a self-contained file.
const options = {
  outdir: "dist",
  outbase: "src",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  // The action runs on Node.js 24; the CLI also supports Node.js 22, the older LTS release.
  target: "node22",
  format: "cjs",
  // `prism-review --version` prints it.
  define: { PRISM_REVIEW_VERSION: JSON.stringify(version) },
  logLevel: "info"
};

await build({ ...options, entryPoints: ["src/action/index.ts"] });
// npm and npx run the CLI as a program, which needs the interpreter line.
await build({ ...options, entryPoints: ["src/cli/main.ts"], banner: { js: "#!/usr/bin/env node" } });
