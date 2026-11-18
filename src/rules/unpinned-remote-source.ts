import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "module" | "hook" | "include";
type Found = { line: number; kind: Kind; name: string };

const terraformFile = /\.(?:tf|tf\.json|hcl)$/i;
const tflintFile = /(?:^|\/)\.?tflint[^/]*\.hcl$/i;
const preCommitFile = /(?:^|\/)\.pre-commit-config\.ya?ml$/i;
const gitlabFile = /(?:^|\/)\.gitlab-ci[^/]*\.ya?ml$|(?:^|\/)\.gitlab\/ci\/[^/]+\.ya?ml$|(?:^|\/)\.gitlab-ci\/[^/]+\.ya?ml$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ|inttest|tests?|fixtures?|examples?)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\//i;

// Branch names, which move with every push, as opposed to tags and commits.
const branchName = /^(?:main|master|develop|development|dev|trunk|HEAD|latest|stable|next|staging|production|prod)$/i;
const commitSha = /^[0-9a-f]{40}$/i;
const templated = /\$\{|\{\{|__\w+__|\$[A-Z_]/;

const moduleStart = /^\s*module\s+"[^"]+"\s*\{/;
const terragruntBlock = /^\s*(?:terraform|unit|stack)\s*(?:"[^"]+"\s*)?\{/;
const sourceKey = /^\s*source\s*=\s*"([^"]+)"/;
const versionKey = /^\s*version\s*=\s*"[^"]+"/;
// `namespace/name/provider`, optionally after a registry host, such as `app.terraform.io/acme/vpc/aws`.
const registrySource = /^(?:[\w.-]+\.[a-z]{2,}\/)?[\w-]+\/[\w-]+\/[\w-]+$/i;
const gitSource = /^(?:git::|git@|(?:https?:\/\/)?(?:github\.com|gitlab\.com|bitbucket\.org)\/)/i;

// The `ref` a git source names, or undefined when it names none.
function gitRef(source: string): string | undefined {
  return /[?&]ref=([^&]+)/.exec(source)?.[1];
}

// Whether a Terraform source can change without an edit to this file.
function movingSource(source: string, hasVersion: boolean): boolean {
  if (templated.test(source) || /^(?:\.{1,2}\/|\/)/.test(source)) {
    return false;
  }
  if (gitSource.test(source)) {
    const ref = gitRef(source);
    return ref === undefined || branchName.test(ref);
  }
  if (/^tfr:\/\//.test(source)) {
    return !/[?&]version=/.test(source);
  }
  return registrySource.test(source) && !hasVersion;
}

// The lines of the block that starts at `index`, by brace depth.
function blockAt(lines: PatchLine[], index: number): PatchLine[] {
  const block: PatchLine[] = [];
  let depth = 0;
  for (const line of lines.slice(index, index + 60)) {
    if (block.length > 0 && line.startsHunk) {
      break;
    }
    block.push(line);
    depth += (line.content.match(/\{/g)?.length ?? 0) - (line.content.match(/\}/g)?.length ?? 0);
    if (depth <= 0) {
      break;
    }
  }
  return block;
}

function terraformSources(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  lines.forEach(({ content }, index) => {
    if (!moduleStart.test(content) && !terragruntBlock.test(content)) {
      return;
    }
    const block = blockAt(lines, index);
    const source = block.find(({ content: text }) => sourceKey.test(text));
    const value = sourceKey.exec(source?.content ?? "")?.[1];
    if (source === undefined || value === undefined) {
      return;
    }
    const version = block.find(({ content: text }) => versionKey.test(text));
    if ((source.added || block[0]?.added === true || version?.added === true) && movingSource(value, version !== undefined)) {
      found.push({ line: source.line, kind: "module", name: value.replace(/\?.*$/, "") });
    }
  });
  return found;
}

function preCommitHooks(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  let repo = "";
  for (const { line, content, added } of lines) {
    const repoMatch = /^\s*-\s*repo\s*:\s*["']?([^"'\s#]+)/.exec(content);
    if (repoMatch !== null) {
      repo = repoMatch[1] ?? "";
      continue;
    }
    const rev = /^\s*rev\s*:\s*["']?([^"'\s#]+)/.exec(content)?.[1];
    if (rev !== undefined && added && branchName.test(rev) && repo !== "local" && repo !== "meta") {
      found.push({ line, kind: "hook", name: `${repo}@${rev}` });
    }
  }
  return found;
}

function gitlabIncludes(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (/^\s*#/.test(content)) {
      return;
    }
    // `- remote: https://...` and `include: https://...`, fetched on every pipeline.
    const remote = /^\s*(?:-\s*)?(?:remote\s*:|include\s*:)\s*["']?(https?:\/\/[^"'\s]+)/.exec(content);
    if (remote !== null && added && !/[0-9a-f]{40}/i.test(remote[1] ?? "")) {
      found.push({ line, kind: "include", name: remote[1] ?? "" });
      return;
    }
    // `- component: host/group/project/name@version`.
    const component = /^\s*(?:-\s*)?component\s*:\s*["']?([^"'\s#]+)/.exec(content);
    if (component !== null && added) {
      const reference = (component[1] ?? "").split("@")[1];
      if (!templated.test(reference ?? "") && (reference === undefined || reference === "~latest" || branchName.test(reference))) {
        found.push({ line, kind: "include", name: component[1] ?? "" });
      }
      return;
    }
    // `- project: group/project` with no `ref`, or a branch.
    const project = /^(\s*)-\s*project\s*:\s*["']?([^"'\s#]+)/.exec(content);
    if (project === null) {
      return;
    }
    const indent = (project[1] ?? "").length;
    const entry = [lines[index] as PatchLine];
    for (const next of lines.slice(index + 1, index + 12)) {
      if (next.startsHunk || (next.content.trim() !== "" && (/^\s*-\s/.test(next.content) ? (/^\s*/.exec(next.content)?.[0].length ?? 0) <= indent : (/^\s*/.exec(next.content)?.[0].length ?? 0) <= indent))) {
        break;
      }
      entry.push(next);
    }
    const ref = entry.map(({ content: text }) => /^\s*ref\s*:\s*["']?([^"'\s#]+)/.exec(text)?.[1]).find((value) => value !== undefined);
    if (entry.some(({ added: changed }) => changed) && !templated.test(project[2] ?? "") && (ref === undefined || (branchName.test(ref) && !commitSha.test(ref)))) {
      found.push({ line, kind: "include", name: project[2] ?? "" });
    }
  });
  return found;
}

const phrases: Record<Kind, string> = {
  module: "pulls Terraform modules from a branch or without a version, so whoever can push to them changes this infrastructure at the next `init`",
  hook: "runs pre-commit hooks from a branch, so each new commit there runs on every developer's machine and in CI",
  include: "includes CI configuration without pinning it, so changes there run in these pipelines with their variables and credentials"
};

export const unpinnedRemoteSourceRule: Rule = {
  id: "unpinned-remote-source",
  description:
    "Warns about code pulled from a moving reference: Terraform and Terragrunt modules from a git branch or the registry without a version, pre-commit hooks at a branch, and GitLab CI includes and components without a fixed version.",
  run({ files, config }) {
    if (!config.rules.unpinnedRemoteSource.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const terraform = terraformFile.test(file.path) && !tflintFile.test(file.path);
      const preCommit = preCommitFile.test(file.path);
      const gitlab = gitlabFile.test(file.path);
      if (
        (!terraform && !preCommit && !gitlab) ||
        file.patch === undefined ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test stacks. The path check also matches CI file names, which the
        // GitLab check reads.
        (terraform && developmentPath.test(file.path)) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found = terraform ? terraformSources(lines) : preCommit ? preCommitHooks(lines) : gitlabIncludes(lines);
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text } = describeLines(lineNumbers);
      const kinds = (Object.keys(phrases) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      const names = [...new Set(found.map(({ name }) => `\`${name}\``))];
      const named = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
      return [
        {
          ruleId: "unpinned-remote-source",
          title: "Code pulled from a moving reference",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the change ${listOf(kinds.map((kind) => phrases[kind]))}: ${listOf(named)}.`,
          recommendation:
            "Pin each source to a release tag or, better, a commit SHA: `?ref=v1.4.0` or `?ref=<sha>` for git module sources, `version = \"5.1.2\"` for registry modules, `rev: <sha>` with `# frozen: v4.6.0` for pre-commit (`pre-commit autoupdate --freeze`), and `ref:` or `@1.2.3` for GitLab includes and components. Update the pins on purpose, with a review of what changed."
        }
      ];
    });
  }
};
