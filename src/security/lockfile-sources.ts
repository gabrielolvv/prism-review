import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";

export type LockfileSourceKind = "unlisted" | "insecure" | "unverified" | "git" | "replaced" | "extra-index";

export type LockfileSource = {
  line: number;
  kind: LockfileSourceKind;
  // For "unlisted": the host, never the full URL, which can carry credentials.
  host?: string;
  // For "replaced": the module a go.mod replace points to.
  module?: string;
};

// The public registries. `rules.lockfileSources.allowedSources` adds private ones.
export const defaultAllowedSources = [
  "https://registry.npmjs.org/",
  "https://registry.yarnpkg.com/",
  "https://pypi.org/",
  "https://files.pythonhosted.org/",
  "https://rubygems.org/",
  "https://index.crates.io/",
  "https://static.crates.io/",
  "https://github.com/rust-lang/crates.io-index"
];

// Tarballs from these hosts are snapshots of a Git repository, not registry releases.
const gitHosts = /^(?:github\.com|codeload\.github\.com|gitlab\.com|bitbucket\.org)$/i;

// A URL to classify, or a finding a reader recognizes by itself.
type Entry = { url: string; extraIndex?: boolean; git?: boolean } | Omit<LockfileSource, "line">;
// `section` is the current TOML table, such as `tool.poetry.source`, or Gemfile.lock section.
type Reader = { files: RegExp; urls: (content: string, section: string) => Entry[] };

const quotedUrl = (key: string) => new RegExp(`${key}["']?\\s*[:=]\\s*["']?([a-z][\\w+.-]*:\\/\\/[^\\s"'#,}]+)`, "i");
const firstUrl = (pattern: RegExp) => (content: string) => {
  const url = pattern.exec(content)?.[1];
  return url === undefined ? [] : [{ url }];
};

const readers: Reader[] = [
  // npm's `"resolved": "..."` (`"version"` in lockfile v1), yarn v1's `resolved "..."`, yarn berry's
  // `resolution: "pkg@https://..."`, and pnpm's `tarball: ...` and `repo: ...`.
  {
    files: /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
    urls: firstUrl(/\b(?:resolved|resolution|tarball|repo|version)["']?\s*[:\s]\s*\{?\s*["']?(?:@?[^"'\s@]+@)?((?:git\+)?[a-z][\w+.-]*:\/\/[^\s"'#,}]+)/i)
  },
  { files: /(?:^|\/)poetry\.lock$/i, urls: firstUrl(quotedUrl("url")) },
  { files: /(?:^|\/)Pipfile(?:\.lock)?$/i, urls: firstUrl(quotedUrl("url")) },
  {
    files: /(?:^|\/)pyproject\.toml$/i,
    urls: (content, section) => {
      const entries: Entry[] = [];
      // PEP 508 direct references, such as `"toolkit @ https://..."` in a dependency list.
      const direct = /["']\s*[\w.-]+(?:\[[^\]]*\])?\s*@\s*((?:git\+)?[a-z][\w+.-]*:\/\/[^"'\s;]+)/i.exec(content);
      if (direct) {
        entries.push({ url: direct[1] ?? "" });
      }
      const index = /^\s*(index-url|extra-index-url)\s*=\s*\[?\s*["']([^"']+)["']/i.exec(content);
      if (index) {
        entries.push({ url: index[2] ?? "", extraIndex: /extra/i.test(index[1] ?? "") });
      }
      // Poetry, uv, and PDM declare indexes as tables with a `url`; other tables' `url` keys are not sources.
      const sourceUrl = /^\s*url\s*=\s*["']([^"']+)["']/i.exec(content);
      if (sourceUrl && /^tool\.(?:poetry\.source|uv\.index|pdm\.source)$/i.test(section)) {
        entries.push({ url: sourceUrl[1] ?? "" });
      }
      // Inline tables such as `shared = { git = "..." }` in uv sources and Poetry dependencies.
      const inline = /\{[^}]*?\b(git|url)\s*=\s*"([^"]+)"/i.exec(content);
      if (inline) {
        entries.push({ url: inline[2] ?? "", git: inline[1]?.toLowerCase() === "git" });
      }
      return entries;
    }
  },
  {
    // `source = { registry = "..." }`, `sdist = { url = "..." }`, and `source = { git = "..." }`.
    files: /(?:^|\/)uv\.lock$/i,
    urls: (content) =>
      [...content.matchAll(/\b(registry|url|git)\s*=\s*"([^"]+)"/gi)].map(([, key, url]) => ({
        url: url ?? "",
        git: key?.toLowerCase() === "git"
      }))
  },
  {
    // `old => new version` replaces a module; a local path or the same module path is routine.
    files: /(?:^|\/)go\.mod$/i,
    urls: (content) => {
      const replace = /^\s*(?:replace\s+)?(\S+)(?:\s+v\S+)?\s*=>\s*(\S+)/.exec(content);
      const [, from = "", to = ""] = replace ?? [];
      if (replace === null || from.startsWith("//") || /^[./]/.test(to) || to === from) {
        return [];
      }
      return [{ kind: "replaced" as const, module: /^[\w.~+/-]{1,200}$/.test(to) ? to : "another module" }];
    }
  },
  { files: /(?:^|\/)Cargo\.lock$/i, urls: firstUrl(/^\s*source\s*=\s*"((?:registry\+|sparse\+|git\+)?[a-z][\w+.-]*:\/\/[^"]+)"/i) },
  { files: /(?:^|\/)Gemfile\.lock$/i, urls: firstUrl(/^\s*remote:\s*([a-z][\w+.-]*:\/\/\S+)/i) },
  { files: /(?:^|\/)\.npmrc$/i, urls: firstUrl(/^\s*(?:@[\w.-]+:)?registry\s*=\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  { files: /(?:^|\/)\.yarnrc\.yml$/i, urls: firstUrl(/^\s*npmRegistryServer:\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  {
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$|(?:^|\/)pip\.conf$/i,
    urls: (content) => {
      // `--trusted-host` lets pip skip TLS verification for that host.
      if (/^\s*(?:--)?trusted-host\b/i.test(content)) {
        return [{ kind: "unverified" as const }];
      }
      const index = /^\s*(-i|--index-url|index-url|--extra-index-url|extra-index-url|-f|--find-links)(?:\s*=\s*|\s+)(\S+)/i.exec(content);
      if (index) {
        return [{ url: index[2] ?? "", extraIndex: /extra/i.test(index[1] ?? "") }];
      }
      // `name @ https://...` and `-e git+https://...`. Comments may hold any URL.
      const direct = /^[^#]*?(?:@\s*|^\s*(?:-e\s+)?)((?:git\+)?[a-z][\w+.-]*:\/\/\S+)/i.exec(content);
      return direct ? [{ url: direct[1] ?? "" }] : [];
    }
  }
];

export function isSourceFile(path: string): boolean {
  return !isTestDataPath(path) && readers.some((reader) => reader.files.test(path));
}

// Runs before the size limit, since lockfile diffs are often over it, and before redaction,
// which masks credentials inside URLs.
export function findLockfileSources(path: string, patch: string, allowedSources: string[]): LockfileSource[] {
  const reader = readers.find((candidate) => candidate.files.test(path));
  if (reader === undefined || isTestDataPath(path)) {
    return [];
  }
  const allowed = [...defaultAllowedSources, ...allowedSources].flatMap((source) => parseUrl(source) ?? []);
  let section = "";
  const found: LockfileSource[] = [];

  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    // Gemfile.lock sections start at the first column, so git shows the current one after `@@`.
    // TOML table headers start with `[`, which git does not show, so a hunk starts with none.
    if (startsHunk) {
      section = sectionName(hunkContext ?? "") ?? "";
    }
    section = sectionName(content) ?? section;
    if (!added) {
      continue;
    }

    for (const entry of reader.urls(content, section)) {
      const source =
        "kind" in entry
          ? entry
          : entry.extraIndex
            ? { kind: "extra-index" as const }
            : classify(entry.url, allowed, section === "GIT" || entry.git === true);
      if (source !== undefined) {
        found.push({ line, ...source });
      }
    }
  }

  return found;
}

function sectionName(content: string): string | undefined {
  return /^([A-Z]+)$|^\s*\[\[?\s*([^\]\s]+)\s*\]\]?\s*(?:#.*)?$/.exec(content.trimEnd())?.slice(1).find(Boolean);
}

function classify(raw: string, allowed: URL[], gitSection: boolean): Omit<LockfileSource, "line"> | undefined {
  if (gitSection || /^git\+|^git:|^ssh:/i.test(raw)) {
    return { kind: "git" };
  }
  const url = parseUrl(raw.replace(/^(?:registry|sparse)\+/i, ""));
  if (url === undefined || url.protocol === "file:") {
    return undefined;
  }
  if (allowed.some((source) => isUnder(url, source))) {
    return undefined;
  }
  if (url.protocol === "http:") {
    return { kind: "insecure" };
  }
  if (gitHosts.test(url.hostname)) {
    return { kind: "git" };
  }
  return { kind: "unlisted", host: url.hostname };
}

// Same scheme, host, and port, and a path that continues the allowed one at a `/`.
function isUnder(url: URL, source: URL): boolean {
  // URL parsing already reads `https://registry.npmjs.org@evil.example/` as host evil.example.
  if (url.protocol !== source.protocol || url.host !== source.host) {
    return false;
  }
  const base = source.pathname.endsWith("/") ? source.pathname : `${source.pathname}/`;
  return url.pathname === source.pathname || url.pathname.startsWith(base);
}

export function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
