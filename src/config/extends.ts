import { parse } from "yaml";
import { parseConfigObject } from "./load-config.js";
import type { PrismConfig } from "./schema.js";

// Where `extends` points: a file in the same repository, such as `.github/prism-review-base.yml`, or
// one in another repository at a tag, branch, or commit, such as `acme/policies/prism-review.yml@v2`.
export type ExtendsTarget =
  | { kind: "local"; path: string }
  | { kind: "remote"; owner: string; repo: string; path: string; ref: string };

// Reads a configuration file, or returns undefined when it does not exist. `source` names it in errors.
export type ConfigReader = (target: ExtendsTarget) => Promise<{ raw: string; source: string } | undefined>;

const maxDepth = 5;
const remote = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([\w.-]{1,100})\/([^@\s]{1,500})@([\w./-]{1,250})$/;
const localPath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^@\s\\]{1,500}$/;

export function parseExtends(value: string, source: string): ExtendsTarget {
  const trimmed = value.trim();
  const match = remote.exec(trimmed);
  if (match) {
    const [, owner = "", repo = "", path = "", ref = ""] = match;
    return { kind: "remote", owner, repo, path, ref };
  }
  if (localPath.test(trimmed)) {
    return { kind: "local", path: trimmed.replace(/^\.\//, "") };
  }
  throw new Error(
    `Invalid Prism Review configuration in ${source}: extends must be a path in this repository, such as .github/prism-review-base.yml, or owner/repo/path@ref, such as acme/policies/prism-review.yml@v2.`
  );
}

// Parses a configuration file and the files it extends, each one's settings laid over the one it
// extends: objects merge key by key, and lists and values replace the extended ones. It also returns
// the extended files in this repository, which config-change reports like the configuration itself.
// `path` is the configuration's own path in the repository, so a file that extends it back is caught.
export async function resolveConfig(
  raw: string,
  source: string,
  read: ConfigReader,
  path?: string
): Promise<{ config: PrismConfig; extendedPaths: string[] }> {
  const extendedPaths: string[] = [];
  const chain = path === undefined ? [] : [targetKey({ kind: "local", path: path.replace(/^\.\//, "") })];
  const merged = await resolveObject(raw, source, read, chain, extendedPaths);
  return { config: parseConfigObject(merged, source), extendedPaths };
}

async function resolveObject(
  raw: string,
  source: string,
  read: ConfigReader,
  chain: string[],
  extendedPaths: string[]
): Promise<Record<string, unknown>> {
  const object = parseYaml(raw, source);
  const { extends: target, ...settings } = object;
  if (target === undefined) {
    return settings;
  }
  if (typeof target !== "string") {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends must be a string.`);
  }
  if (chain.length > maxDepth) {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends goes more than ${maxDepth} files deep.`);
  }
  const parsed = parseExtends(target, source);
  const key = targetKey(parsed);
  if (chain.includes(key)) {
    throw new Error(`Invalid Prism Review configuration in ${source}: extends ${target}, which extends it back.`);
  }
  const parent = await read(parsed);
  if (parent === undefined) {
    throw new Error(
      `Invalid Prism Review configuration in ${source}: extends ${target}, which was not found${parsed.kind === "remote" ? " or the token cannot read it" : ""}.`
    );
  }
  if (parsed.kind === "local") {
    extendedPaths.push(parsed.path);
  }
  const base = await resolveObject(parent.raw, parent.source, read, [...chain, key], extendedPaths);
  return merge(base, settings);
}

function parseYaml(raw: string, source: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = parse(raw) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Prism Review configuration in ${source}: ${message}`);
  }
  if (!isObject(parsed)) {
    throw new Error(`Invalid Prism Review configuration in ${source}: (root): Expected a mapping.`);
  }
  return parsed;
}

function merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isObject(current) && isObject(value) ? merge(current, value) : value;
  }
  return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function targetKey(target: ExtendsTarget): string {
  return target.kind === "local" ? `local:${target.path}` : `${target.owner}/${target.repo}/${target.path}@${target.ref}`;
}
