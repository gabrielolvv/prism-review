// The lockfiles that pin what a manifest installs. Libraries' manifests, such as `*.gemspec`, and
// `requirements*.txt`, which pins versions itself, have none.
const lockfileNames: Array<[RegExp, string[]]> = [
  [/(?:^|\/)package\.json$/, ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"]],
  [/(?:^|\/)pyproject\.toml$/i, ["poetry.lock", "uv.lock", "pdm.lock"]],
  [/(?:^|\/)Pipfile$/, ["Pipfile.lock"]],
  [/(?:^|\/)Gemfile$/, ["Gemfile.lock"]],
  [/(?:^|\/)Cargo\.toml$/, ["Cargo.lock"]]
];

export function lockfilesFor(manifestPath: string): string[] {
  return lockfileNames.find(([pattern]) => pattern.test(manifestPath))?.[1] ?? [];
}

// The manifest's directory and every directory above it, nearest first, as "" for the root. In a
// workspace, the lockfile usually sits at the root rather than next to each package's manifest.
export function lockfileDirectories(manifestPath: string): string[] {
  const parts = manifestPath.split("/").slice(0, -1);
  return parts.map((_, index) => parts.slice(0, parts.length - index).join("/")).concat("");
}

export function joinPath(directory: string, name: string): string {
  return directory === "" ? name : `${directory}/${name}`;
}
