import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { describeFailure, failingFindings } from "../analysis/check-outcome.js";
import { loadConfig } from "../config/load-config.js";
import { defaultConfigPath } from "../config/schema.js";
import { renderMarkdown } from "../reporting/render-markdown.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { parseUnifiedDiff } from "../testing/parse-unified-diff.js";

const usage = [
  "Usage: prism-review analyze --diff <path|-> [--config <path>]",
  "",
  "  --diff <path|->   Unified diff to review, such as the output of `git diff`. Use - to read stdin.",
  "                    --fixture is accepted as an alias.",
  "  --config <path>   Configuration file. Defaults to .prism-review.yml when it exists.",
  "",
  "Example: git diff origin/main...HEAD | prism-review analyze --diff -",
  ""
].join("\n");

type CliOptions = {
  diff?: string;
  config?: string;
  help: boolean;
};

class UsageError extends Error {}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "--help" || command === "-h") {
    process.stdout.write(usage);
    return;
  }

  if (command !== "analyze") {
    throw new UsageError(command ? `Unknown command: ${command}` : "Missing command.");
  }

  const options = parseArgs(args);
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  if (!options.diff) {
    throw new UsageError("Missing required --diff option.");
  }

  // An explicit --config that does not exist would silently fall back to the defaults,
  // which turns off a check.failOn gate without anyone noticing.
  if (options.config !== undefined && !existsSync(resolve(options.config))) {
    throw new Error(`Configuration file not found: ${options.config}`);
  }

  const configPath = options.config ?? defaultConfigPath;
  const config = loadConfig(resolve(configPath));
  const files = prepareChangedFiles(parseUnifiedDiff(readDiff(options.diff)), config);
  const result = analyzePullRequest(files, config, { configPath });
  process.stdout.write(`${renderMarkdown(result, config.comment)}\n`);

  const failing = failingFindings(result, config.check.failOn);
  if (failing.length > 0) {
    process.stderr.write(`${describeFailure(failing, config.check.failOn)}\n`);
    process.exitCode = 1;
  }
}

function readDiff(source: string): string {
  if (source !== "-") {
    return readFileSync(resolve(source), "utf8");
  }

  if (process.stdin.isTTY) {
    throw new UsageError("--diff - reads a diff from stdin; pipe one in, for example from `git diff`.");
  }

  return readFileSync(0, "utf8");
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--diff" || arg === "--fixture" || arg === "--config") {
      const value = args[index + 1];
      if (value === undefined || (value.startsWith("--") && value !== "-")) {
        throw new UsageError(`Missing value for ${arg}.`);
      }

      if (arg === "--config") {
        options.config = value;
      } else {
        options.diff = value;
      }
      index += 1;
      continue;
    }

    throw new UsageError(`Unknown option: ${arg}`);
  }

  return options;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Prism Review failed: ${message}\n`);
  if (error instanceof UsageError) {
    process.stderr.write(`\n${usage}`);
  }
  process.exitCode = 1;
});
