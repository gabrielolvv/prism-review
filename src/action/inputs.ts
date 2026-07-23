import { isSafeRepositoryPath, normalizeRepositoryPath } from "../analysis/repository-path.js";
import { defaultConfigPath } from "../config/schema.js";

export type ActionInputs = {
  githubToken: string;
  configPath: string;
  dryRun: boolean;
};

export function readInputs(): ActionInputs {
  const githubToken = getRequiredInput("github-token");

  return {
    githubToken,
    configPath: readConfigPath(),
    dryRun: parseBooleanInput(getInput("dry-run") || "false")
  };
}

function readConfigPath(): string {
  const configPath = getInput("config-path") || defaultConfigPath;
  if (!isSafeRepositoryPath(configPath)) {
    throw new Error(
      `Invalid config-path "${configPath}": config-path must be a relative path inside the repository.`
    );
  }

  return normalizeRepositoryPath(configPath);
}

// Matches the runner and @actions/core: spaces become underscores, hyphens are kept.
function getInput(name: string): string {
  const envName = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  return process.env[envName]?.trim() ?? "";
}

function getRequiredInput(name: string): string {
  const value = getInput(name);
  if (!value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function parseBooleanInput(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
