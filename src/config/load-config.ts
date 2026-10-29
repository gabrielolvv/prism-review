import { parse } from "yaml";
import { prismConfigSchema, type PrismConfig } from "./schema.js";

export function parseConfig(raw: string, source: string): PrismConfig {
  let parsed: unknown;
  try {
    parsed = parse(raw) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw invalidConfig(source, message);
  }

  return parseConfigObject(parsed, source);
}

// Validates parsed settings, such as those `resolveConfig` merges from several files.
export function parseConfigObject(parsed: unknown, source: string): PrismConfig {
  const result = prismConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`
    );
    throw invalidConfig(source, issues.join("; "));
  }

  return result.data;
}

function invalidConfig(source: string, details: string): Error {
  return new Error(`Invalid Prism Review configuration in ${source}: ${details}`);
}
