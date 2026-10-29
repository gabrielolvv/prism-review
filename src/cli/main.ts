import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { codeOwnersPaths, parseCodeOwners, type CodeOwners } from "../analysis/code-owners.js";
import { gitAttributesPath, parseGitAttributes } from "../analysis/git-attributes.js";
import { findLockfiles } from "../github/load-lockfiles.js";
import { describeFailure, failingFindings } from "../analysis/check-outcome.js";
import { loadConfig } from "../config/load-config.js";
import { defaultConfigPath } from "../config/schema.js";
import type { ReviewResult } from "../analysis/finding.js";
import { defaultRules } from "../rules/index.js";
import { renderJson } from "../reporting/render-json.js";
import { renderMarkdown, type RenderOptions } from "../reporting/render-markdown.js";
import { renderSarif } from "../reporting/render-sarif.js";
import { renderText } from "../reporting/render-text.js";
import { prepareChangedFiles } from "../security/prepare-changed-files.js";
import { parseUnifiedDiff } from "../testing/parse-unified-diff.js";
import { initRepository } from "./init.js";
import { version } from "./version.js";

const usage = [
  "Usage: prism-review analyze (--diff <path|-> | --staged | --base <ref>) [--config <path>]",
  "                            [--format text|markdown|json|sarif] [--fail-on never|warning|high]",
  "       prism-review init [--ref <ref>] [--force]",
  "",
  "analyze reviews a diff:",
  "  --diff <path|->   Unified diff to review, such as the output of `git diff`. Use - to read stdin.",
  "                    --fixture is accepted as an alias.",
  "  --staged          Review the changes staged for the next commit, as `git diff --cached` shows them.",
  "  --base <ref>      Review the changes on this branch since it left <ref>, such as origin/main,",
  "                    as `git diff <ref>...HEAD` shows them.",
  "  --config <path>   Configuration file. Defaults to .prism-review.yml when it exists.",
  "  --format <format> text, one line per finding, the default in a terminal; markdown, the pull",
  "                    request comment, the default otherwise; json; or sarif for code scanning.",
  "                    text is colored in a terminal, unless NO_COLOR is set, or when FORCE_COLOR is.",
  "  --fail-on <level> Exit with status 1 on findings of this severity, instead of check.failOn.",
  "",
  "init adds .github/workflows/prism-review.yml and .prism-review.yml to the repository in the",
  "current directory:",
  "  --ref <ref>       Use the action at this tag or commit, such as v0, instead of pinning the",
  "                    commit of this version's release.",
  "  --force           Replace the files when they already exist.",
  "",
  "  --version         Print the version.",
  "",
  "Example: prism-review analyze --base origin/main --fail-on high",
  ""
].join("\n");

const formats = ["text", "markdown", "json", "sarif"] as const;
type Format = (typeof formats)[number];

const failOnLevels = ["never", "warning", "high"] as const;
type FailOn = (typeof failOnLevels)[number];

type CliOptions = {
  diff?: string;
  staged: boolean;
  base?: string;
  config?: string;
  format?: Format;
  failOn?: FailOn;
  help: boolean;
};

class UsageError extends Error {}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "--help" || command === "-h") {
    process.stdout.write(usage);
    return;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write(`${version}\n`);
    return;
  }

  if (command === "init") {
    await init(args);
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

  const sources = [options.diff !== undefined, options.staged, options.base !== undefined].filter(Boolean).length;
  if (sources !== 1) {
    throw new UsageError(sources === 0 ? "Missing --diff, --staged, or --base." : "Use only one of --diff, --staged, and --base.");
  }

  // An explicit --config that does not exist would silently fall back to the defaults,
  // which turns off a check.failOn gate without anyone noticing.
  if (options.config !== undefined && !existsSync(resolve(options.config))) {
    throw new Error(`Configuration file not found: ${options.config}`);
  }

  const configPath = options.config ?? defaultConfigPath;
  const config = loadConfig(resolve(configPath));
  const diff = options.diff !== undefined ? await readDiff(options.diff) : gitDiff(options.base);
  // Nothing staged, or a branch with no changes, is nothing to review rather than bad input.
  if (options.diff === undefined && diff.trim() === "") {
    process.stdout.write("No changes to review.\n");
    return;
  }
  const files = prepareChangedFiles(parseDiff(diff), config);
  const generated = config.ignoreGenerated && isFile(gitAttributesPath)
    ? parseGitAttributes(readFileSync(gitAttributesPath, "utf8"))
    : undefined;
  // The working tree stands in for the base commit: a lockfile here was there before this change.
  const existingLockfiles = config.rules.staleLockfiles.enabled
    ? await findLockfiles(files, async (directory) =>
        readdirSync(directory === "" ? "." : directory, { withFileTypes: true }).flatMap((entry) =>
          entry.isFile() ? [entry.name] : []
        )
      ).catch(() => undefined)
    : undefined;
  const result = analyzePullRequest(files, config, {
    configPath,
    isGenerated: generated?.isGenerated,
    existingLockfiles
  });
  const codeOwners = config.comment.codeOwners ? readLocalCodeOwners() : undefined;
  // A person at a terminal gets the compact text; a pipe or a file gets the Markdown it always got.
  const format = options.format ?? (process.stdout.isTTY ? "text" : "markdown");
  process.stdout.write(`${render(result, format, { ...config.comment, ownersOf: codeOwners?.ownersOf })}\n`);

  const failOn = options.failOn ?? config.check.failOn;
  const failing = failingFindings(result, failOn);
  if (failing.length > 0) {
    process.stderr.write(`${describeFailure(failing, failOn, options.failOn === undefined ? "check.failOn" : "--fail-on")}\n`);
    process.exitCode = 1;
  }
}

async function init(args: string[]): Promise<void> {
  let ref: string | undefined;
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage);
      return;
    }
    if (arg === "--force") {
      force = true;
    } else if (arg === "--ref") {
      ref = args[index + 1];
      if (ref === undefined || !/^[\w.\/-]{1,100}$/.test(ref)) {
        throw new UsageError("--ref needs a tag, branch, or commit, such as v0.");
      }
      index += 1;
    } else {
      throw new UsageError(`Unknown option: ${arg}`);
    }
  }

  // The workflow must land in the repository's own .github directory, not a subdirectory's.
  if (!existsSync(".git")) {
    throw new Error("Run prism-review init from the root of a Git repository.");
  }

  const result = await initRepository({ directory: ".", force, ref, version });
  for (const path of result.written) {
    process.stdout.write(`Created ${path}\n`);
  }
  for (const path of result.skipped) {
    process.stdout.write(`Left ${path} unchanged because it exists; use --force to replace it.\n`);
  }
  if (ref === undefined && !result.uses.includes("#")) {
    process.stdout.write(
      "Could not look up this version's release commit, so the workflow uses gabrielolvv/prism-review@v0, which follows the latest 0.x release.\n"
    );
  }
  if (result.written.length > 0) {
    process.stdout.write(
      [
        "",
        "Next: commit these files and open a pull request. Prism Review reviews that pull request too, with the default",
        "configuration, since it reads .prism-review.yml from the base branch, and reports the new workflow and",
        "configuration as high risk, as it does for every change to them. Once merged, your configuration applies.",
        ""
      ].join("\n")
    );
  }
}

// The CODEOWNERS file in the current directory, found the way GitHub looks for it.
function readLocalCodeOwners(): CodeOwners | undefined {
  const path = codeOwnersPaths.find(isFile);
  return path === undefined ? undefined : parseCodeOwners(readFileSync(path, "utf8"));
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function render(result: ReviewResult, format: Format, options: RenderOptions): string {
  if (format === "text") {
    return renderText(result, { includeLowSeverity: options.includeLowSeverity, color: useColor() });
  }
  if (format === "json") {
    return renderJson(result);
  }
  if (format === "sarif") {
    return renderSarif(result, defaultRules);
  }
  return renderMarkdown(result, options);
}

// https://no-color.org: a non-empty NO_COLOR turns colors off; FORCE_COLOR turns them on in a pipe,
// such as pre-commit's.
function useColor(): boolean {
  if ((process.env.NO_COLOR ?? "") !== "") {
    return false;
  }
  const forced = process.env.FORCE_COLOR;
  return forced !== undefined && forced !== "" ? forced !== "0" && forced !== "false" : process.stdout.isTTY === true;
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

// Runs git in the current directory, without a shell. External diff tools and colors are turned off,
// since the review needs git's own unified diff.
function gitDiff(base: string | undefined): string {
  const range = base === undefined ? ["--cached"] : [`${base}...HEAD`];
  const result = spawnSync("git", ["diff", "--no-color", "--no-ext-diff", ...range], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.error !== undefined) {
    throw new Error(`Could not run git: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git diff failed: ${result.stderr.trim().split("\n")[0] ?? ""}`);
  }
  return result.stdout;
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
  const options: CliOptions = { staged: false, help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--staged") {
      options.staged = true;
      continue;
    }

    if (arg === "--base") {
      const value = args[index + 1];
      // A value starting with - would reach git as an option.
      if (value === undefined || value.startsWith("-") || /\s/.test(value)) {
        throw new UsageError("--base needs a branch, tag, or commit, such as origin/main.");
      }
      options.base = value;
      index += 1;
      continue;
    }

    if (arg === "--fail-on") {
      const value = args[index + 1];
      if (!failOnLevels.includes(value as FailOn)) {
        throw new UsageError("--fail-on needs never, warning, or high.");
      }
      options.failOn = value as FailOn;
      index += 1;
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
          throw new UsageError(`Unknown format: ${value}. Use text, markdown, json, or sarif.`);
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
