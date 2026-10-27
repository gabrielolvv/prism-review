import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { codeOwnersPaths, parseCodeOwners, type CodeOwners } from "../analysis/code-owners.js";
import { describeFailure, failingFindings } from "../analysis/check-outcome.js";
import { loadConfig } from "../config/load-config.js";
import { defaultConfigPath } from "../config/schema.js";
import type { ReviewResult } from "../analysis/finding.js";
import { defaultRules } from "../rules/index.js";
import { renderJson } from "../reporting/render-json.js";
import { renderMarkdown, type RenderOptions } from "../reporting/render-markdown.js";
import { renderSarif } from "../reporting/render-sarif.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { parseUnifiedDiff } from "../testing/parse-unified-diff.js";

const usage = [
  "Usage: prism-review analyze --diff <path|-> [--config <path>] [--format markdown|json|sarif]",
  "",
  "  --diff <path|->   Unified diff to review, such as the output of `git diff`. Use - to read stdin.",
  "                    --fixture is accepted as an alias.",
  "  --config <path>   Configuration file. Defaults to .prism-review.yml when it exists.",
  "  --format <format> markdown (default), json, or sarif for GitHub code scanning.",
  "",
  "Example: git diff origin/main...HEAD | prism-review analyze --diff -",
  ""
].join("\n");

const formats = ["markdown", "json", "sarif"] as const;
type Format = (typeof formats)[number];

type CliOptions = {
  diff?: string;
  config?: string;
  format: Format;
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
  const files = prepareChangedFiles(parseDiff(await readDiff(options.diff)), config);
  const result = analyzePullRequest(files, config, { configPath });
  const codeOwners = config.comment.codeOwners ? readLocalCodeOwners() : undefined;
  process.stdout.write(`${render(result, options.format, { ...config.comment, ownersOf: codeOwners?.ownersOf })}\n`);

  const failing = failingFindings(result, config.check.failOn);
  if (failing.length > 0) {
    process.stderr.write(`${describeFailure(failing, config.check.failOn)}\n`);
    process.exitCode = 1;
  }
}

// The CODEOWNERS file in the current directory, found the way GitHub looks for it.
function readLocalCodeOwners(): CodeOwners | undefined {
  const path = codeOwnersPaths.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return path === undefined ? undefined : parseCodeOwners(readFileSync(path, "utf8"));
}

function render(result: ReviewResult, format: Format, options: RenderOptions): string {
  if (format === "json") {
    return renderJson(result);
  }
  if (format === "sarif") {
    return renderSarif(result, defaultRules);
  }
  return renderMarkdown(result, options);
}

// The CLI is meant to gate pushes, so input it cannot review is an error, never an empty
// review that passes.
function parseDiff(diff: string) {
  if (diff.trim() === "") {
    throw new Error(
      "The diff is empty. If it came from `git diff`, check that the command succeeded and that the range has changes."
    );
  }

  if (diff.includes(`${String.fromCharCode(27)}[`)) {
    throw new Error("The diff contains terminal color codes; run `git diff --no-color`.");
  }

  const files = parseUnifiedDiff(diff);
  if (files.length === 0) {
    throw new Error("No `diff --git` sections found. Pass the output of `git diff`, not a plain patch or a file list.");
  }

  return files;
}

async function readDiff(source: string): Promise<string> {
  if (source !== "-") {
    return readFileSync(resolve(source), "utf8");
  }

  if (process.stdin.isTTY) {
    throw new UsageError("--diff - reads a diff from stdin; pipe one in, for example from `git diff`.");
  }

  // readFileSync(0) fails with EAGAIN when stdin is a non-blocking pipe holding more than one
  // buffer, which is the usual `git diff | prism-review` case, so read it as a stream.
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { format: "markdown", help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--diff" || arg === "--fixture" || arg === "--config" || arg === "--format") {
      const value = args[index + 1];
      if (value === undefined || (value.startsWith("--") && value !== "-")) {
        throw new UsageError(`Missing value for ${arg}.`);
      }

      if (arg === "--config") {
        options.config = value;
      } else if (arg === "--format") {
        if (!formats.includes(value as Format)) {
          throw new UsageError(`Unknown format: ${value}. Use markdown, json, or sarif.`);
        }
        options.format = value as Format;
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
