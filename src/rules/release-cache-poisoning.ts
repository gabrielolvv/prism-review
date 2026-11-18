import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";

type Job = { name: string; lines: PatchLine[] };
type Found = { line: number; name: string };

const workflowFile = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const exampleWorkflow = /(?:^|[\/_.-])(?:examples?|samples?|demos?|templates?|fixtures?|testdata)(?:[\/_.-]|$)/i;
const jobsKey = /^jobs\s*:\s*(?:#.*)?$/;
const jobKey = /^ {2}(["']?[\w-]+["']?)\s*:\s*(?:#.*)?$/;
const commentLine = /^\s*#/;

// Triggers of a release: a published release, or a pushed tag.
const releaseTrigger = /^\s*on\s*:.*\brelease\b|^\s*-\s*release\s*(?:#.*)?$|^\s+release\s*:\s*(?:#.*)?$|^\s+tags\s*:/m;
// Steps that publish a package, an image, or release files.
const publishStep = new RegExp(
  [
    String.raw`uses\s*:\s*["']?(?:pypa/gh-action-pypi-publish|softprops/action-gh-release|ncipollo/release-action|svenstaro/upload-release-action|JS-DevTools/npm-publish|rubygems/release-gem|changesets/action|cycjimmy/semantic-release-action)@`,
    String.raw`\b(?:npm|pnpm|lerna|changeset)\s+publish\b|\byarn\s+(?:npm\s+)?publish\b|\btwine\s+upload\b|\b(?:poetry|uv|flit|hatch)\s+publish\b|\bcargo\s+publish\b|\bgem\s+push\b|\bdotnet\s+nuget\s+push\b|\bmvn\b[^\n]*\bdeploy\b|\bgradlew?\b[^\n]*\bpublish\w*\b|\bgh\s+release\s+(?:create|upload)\b|\bsemantic-release\b`
  ].join("|"),
  "i"
);

// GoReleaser publishes with `release`, unless `--snapshot` or a skip keeps it to a local build.
const goreleaserAction = /uses\s*:\s*["']?goreleaser\/goreleaser-action@/i;
const goreleaserRelease = /\brelease\b/;
const goreleaserLocal = /--snapshot\b|--skip[=\s]+[\w,]*publish|--skip-publish\b/;
// `docker push` to a registry, rather than one a test starts on the runner.
const dockerPush = /\bdocker\s+(?:image\s+)?push\s+(\S+)/;
const localRegistry = /localhost|127\.0\.0\.1|:5000\b|kind-registry|\$\{?\w*HOST\b/i;

// Steps that restore a cache that other workflows on the default branch can write.
const cacheAction = /uses\s*:\s*["']?(actions\/cache(?:\/restore)?|Swatinem\/rust-cache|actions\/setup-go|gradle\/actions\/setup-gradle|gradle\/gradle-build-action|actions\/setup-(?:node|python|java|dotnet)|ruby\/setup-ruby|astral-sh\/setup-uv|docker\/(?:build-push|bake)-action|denoland\/setup-deno)@([^\s"'#]*)/i;

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

function jobsIn(lines: PatchLine[]): Job[] {
  const start = lines.findIndex(({ content }) => jobsKey.test(content));
  if (start < 0) {
    return [];
  }
  const jobs: Job[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line.content) && line.content.trim() !== "" && !commentLine.test(line.content)) {
      break;
    }
    const key = jobKey.exec(line.content);
    if (key !== null) {
      jobs.push({ name: (key[1] ?? "").replace(/["']/g, ""), lines: [line] });
      continue;
    }
    jobs.at(-1)?.lines.push(line);
  }
  return jobs;
}

// The `with:` settings of the step whose `uses:` line is at `index`, as `key: value` text.
function stepSettings(lines: PatchLine[], index: number): string[] {
  const usesLine = lines[index]?.content ?? "";
  const stepIndent = indentOf(usesLine.replace(/^(\s*)-\s+/, "$1  "));
  const settings: string[] = [];
  for (const { content } of lines.slice(index + 1, index + 30)) {
    if (content.trim() === "" || commentLine.test(content)) {
      continue;
    }
    if (indentOf(content) < stepIndent || /^\s*-\s/.test(content) && indentOf(content) <= stepIndent) {
      break;
    }
    settings.push(content.trim());
  }
  return settings;
}

const enabled = (settings: string[], key: string) => settings.some((text) => new RegExp(`^${key}\\s*:\\s*["']?(?!false\\b|["']|$)\\S`).test(text));
const disabled = (settings: string[], key: string) => settings.some((text) => new RegExp(`^${key}\\s*:\\s*["']?(?:false|off)\\b`).test(text));

// Whether the step restores a cache, given its action, version, and settings.
function restoresCache(action: string, version: string, settings: string[]): boolean {
  const name = action.toLowerCase();
  const major = Number(/^v(\d+)/.exec(version)?.[1] ?? Number.NaN);
  if (name === "actions/cache" || name === "actions/cache/restore") {
    return !settings.some((text) => /^lookup-only\s*:\s*true\b/.test(text));
  }
  if (name === "swatinem/rust-cache") {
    return true;
  }
  // setup-go caches by default from v4, and Gradle's setup caches by default.
  if (name === "actions/setup-go") {
    return Number.isNaN(major) || major >= 4 ? !disabled(settings, "cache") : enabled(settings, "cache");
  }
  if (name === "gradle/actions/setup-gradle" || name === "gradle/gradle-build-action") {
    return !settings.some((text) => /^cache-disabled\s*:\s*true\b/.test(text));
  }
  if (name === "ruby/setup-ruby") {
    return settings.some((text) => /^bundler-cache\s*:\s*true\b/.test(text));
  }
  if (name === "astral-sh/setup-uv") {
    return settings.some((text) => /^enable-cache\s*:\s*["']?true\b/.test(text));
  }
  if (name === "docker/build-push-action" || name === "docker/bake-action") {
    // `cache-from: type=gha`, inline or on the lines of a block.
    return settings.some((text) => /\btype=gha\b/.test(text));
  }
  return enabled(settings, "cache");
}

function publishes(job: Job): { line: number; added: boolean }[] {
  const found: { line: number; added: boolean }[] = [];
  job.lines.forEach(({ line, content, added }, index) => {
    if (commentLine.test(content)) {
      return;
    }
    const push = dockerPush.exec(content);
    const goreleaser = goreleaserAction.test(content)
      ? stepSettings(job.lines, index).find((text) => /^args\s*:/.test(text)) ?? ""
      : /\bgoreleaser\s+release\b/.test(content)
        ? content
        : undefined;
    if (
      publishStep.test(content) ||
      (push !== null && !localRegistry.test(push[1] ?? "")) ||
      (goreleaser !== undefined && goreleaserRelease.test(goreleaser) && !goreleaserLocal.test(goreleaser))
    ) {
      found.push({ line, added });
    }
  });
  return found;
}

function cachingSteps(job: Job): Found[] {
  const found: Found[] = [];
  job.lines.forEach(({ line, content }, index) => {
    const match = cacheAction.exec(content);
    if (match === null || commentLine.test(content)) {
      return;
    }
    const action = match[1] ?? "";
    if (restoresCache(action, match[2] ?? "", stepSettings(job.lines, index))) {
      found.push({ line, name: action });
    }
  });
  return found;
}

export const releaseCachePoisoningRule: Rule = {
  id: "release-cache-poisoning",
  description:
    "Warns about GitHub Actions release and publishing jobs that restore caches, which any workflow run on the default branch, including one that runs a pull request's code, can poison, as in the 2024 Ultralytics compromise.",
  run({ files, config }) {
    if (!config.rules.releaseCachePoisoning.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !workflowFile.test(file.path) ||
        file.patch === undefined ||
        exampleWorkflow.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }
      const lines = patchLines(file.patch);
      const jobsStart = lines.findIndex(({ content }) => jobsKey.test(content));
      const triggers = (jobsStart < 0 ? lines : lines.slice(0, jobsStart)).filter(({ content }) => !commentLine.test(content));
      const jobs = jobsIn(lines);
      const triggerText = triggers.map(({ content }) => content).join("\n");
      // A workflow that only releases, whose other jobs build what the publishing job ships. Workflows
      // that also run for branches and pull requests are checks that happen to run on tags too.
      const releaseWorkflow =
        releaseTrigger.test(triggerText) &&
        !/\bpull_request\b|^\s+branches(?:-ignore)?\s*:|\bschedule\s*:/m.test(triggerText) &&
        jobs.some((job) => publishes(job).length > 0);

      const found = jobs.flatMap((job) => {
        const publishing = publishes(job);
        if (publishing.length === 0 && !releaseWorkflow) {
          return [];
        }
        const steps = cachingSteps(job);
        // Only new caching steps, or caching steps in a job or workflow that the change makes a release.
        const madeRelease =
          publishing.some(({ added }) => added) || triggers.some(({ content, added }) => added && releaseTrigger.test(content));
        return madeRelease ? steps : steps.filter(({ line }) => job.lines.some((entry) => entry.line === line && entry.added));
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text } = describeLines(lineNumbers);
      const names = [...new Set(found.map(({ name }) => `\`${name}\``))];
      return [
        {
          ruleId: "release-cache-poisoning",
          title: "Release job restores a shared cache",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, a release or publishing job restores a GitHub Actions cache with ${listOf(names)}. Caches written on the default branch are shared with every workflow there, so code that runs in any of them, such as a pull request's code in a \`pull_request_target\` workflow or a compromised test dependency, can plant files that this job builds and publishes.`,
          recommendation:
            "Turn caching off in jobs that build or publish releases, such as `cache: false` for `actions/setup-go` and no `cache:` for the other setup actions, and drop `actions/cache` there. A release built from a clean install is slower but cannot pick up files another workflow left behind."
        }
      ];
    });
  }
};
