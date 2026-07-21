import { build } from "esbuild";

// GitHub runs the action straight from the repository checkout, without
// installing dependencies, so every entry point ships as a self-contained file.
await build({
  entryPoints: ["src/action/index.ts", "src/cli/main.ts"],
  outdir: "dist",
  outbase: "src",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  logLevel: "info"
});
