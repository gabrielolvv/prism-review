import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultConfigPath } from "../config/schema.js";

export const workflowPath = ".github/workflows/prism-review.yml";

const actionRepository = "gabrielolvv/prism-review";
const commitLookupTimeoutMs = 5_000;

export type InitOptions = {
  // The directory to set up, normally the root of a Git repository.
  directory: string;
  // Replaces files that already exist instead of leaving them unchanged.
  force: boolean;
  // How the workflow refers to the action, such as `v0`. Without it, init pins the commit of this
  // version's release tag, or falls back to `v0` when the lookup fails.
  ref?: string;
  version: string;
  findReleaseCommit?: (tag: string) => Promise<string | undefined>;
};

export type InitResult = {
  written: string[];
  skipped: string[];
  // The text after `@` in the workflow's `uses:` line, with the tag comment for a pinned commit.
  uses: string;
};

export async function initRepository(options: InitOptions): Promise<InitResult> {
  const uses = await chooseRef(options);
  const files: Array<[string, string]> = [
    [workflowPath, workflowYaml(uses)],
    [defaultConfigPath, starterConfig]
  ];

  const written: string[] = [];
  const skipped: string[] = [];
  for (const [path, content] of files) {
    const target = join(options.directory, path);
    if (existsSync(target) && !options.force) {
      skipped.push(path);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(path);
  }

  return { written, skipped, uses };
}

async function chooseRef(options: InitOptions): Promise<string> {
  if (options.ref !== undefined) {
    return options.ref;
  }
  // A build from source has no release to pin.
  if (!/^\d+\.\d+\.\d+$/.test(options.version)) {
    return "v0";
  }
  const tag = `v${options.version}`;
  const commit = await (options.findReleaseCommit ?? findReleaseCommit)(tag).catch(() => undefined);
  return commit === undefined ? "v0" : `${commit} # ${tag}`;
}

// The commit a release tag points to, so the workflow can pin it the way the unpinned-action rule
// recommends.
export async function findReleaseCommit(tag: string): Promise<string | undefined> {
  const response = await fetch(`https://api.github.com/repos/${actionRepository}/commits/${encodeURIComponent(tag)}`, {
    headers: { Accept: "application/vnd.github.sha", "User-Agent": "prism-review-cli" },
    signal: AbortSignal.timeout(commitLookupTimeoutMs)
  });
  if (!response.ok) {
    return undefined;
  }
  const sha = (await response.text()).trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
}

// Write access is granted to the job, not the workflow, as the workflow-risk rule recommends.
export function workflowYaml(uses: string): string {
  return `name: Prism Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: ${actionRepository}@${uses}
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          config-path: ${defaultConfigPath}
`;
}

export const starterConfig = `# Prism Review configuration. Every option, with its default, is described in
# https://github.com/${actionRepository}/blob/master/docs/configuration.md
#
# The action reads this file from the pull request's base branch, so a change to it applies to
# the pull requests opened after it is merged.

check:
  # Fail the review job on findings of this severity: never, warning, or high. Mark the job as a
  # required status check in branch protection to block merges on them.
  failOn: never

comment:
  # upsert updates one comment on every push; append posts a new comment each time.
  mode: upsert
  # Questions of your own, added to the reviewer checklist of every review.
  checklist: []

# Files to leave out of the review, such as vendored or generated code that is not marked
# linguist-generated in .gitattributes.
ignorePaths: []
#  - "vendor/**"

# Change a rule's severity, or turn it off.
severity: {}
#  missing-tests: off
`;
