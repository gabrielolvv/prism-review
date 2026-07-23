import { resolve } from "node:path";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { loadConfig } from "../config/load-config.js";
import { defaultConfigPath } from "../config/schema.js";
import { renderMarkdown } from "../reporting/render-markdown.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { loadDiffFixture } from "../testing/fixture-loader.js";

type CliOptions = {
  fixture?: string;
  config?: string;
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command !== "analyze") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const options = parseArgs(args);
  if (!options.fixture) {
    throw new Error("Missing required --fixture option.");
  }

  const configPath = options.config ?? defaultConfigPath;
  const config = loadConfig(resolve(configPath));
  const files = prepareChangedFiles(loadDiffFixture(resolve(options.fixture)), config);
  const result = analyzePullRequest(files, config, { configPath });
  process.stdout.write(`${renderMarkdown(result, config.comment)}\n`);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--fixture") {
      options.fixture = next;
      index += 1;
    }

    if (arg === "--config") {
      options.config = next;
      index += 1;
    }
  }

  return options;
}

function printUsage(): void {
  process.stdout.write("Usage: prism-review analyze --fixture <path> [--config <path>]\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Prism Review failed: ${message}\n`);
  process.exitCode = 1;
});
