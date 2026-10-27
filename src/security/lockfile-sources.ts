import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";

export type LockfileSourceKind = "unlisted" | "insecure" | "git" | "extra-index";

export type LockfileSource = {
  line: number;
  kind: LockfileSourceKind;
  // For "unlisted": the host, never the full URL, which can carry credentials.
  host?: string;
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

type Reader = { files: RegExp; urls: (content: string) => Array<{ url: string; extraIndex?: boolean }> };

const quotedUrl = (key: string) => new RegExp(`${key}["']?\\s*[:=]\\s*["']?([a-z][\\w+.-]*:\\/\\/[^\\s"'#,}]+)`, "i");
const firstUrl = (pattern: RegExp) => (content: string) => {
  const url = pattern.exec(content)?.[1];
  return url === undefined ? [] : [{ url }];
};

const readers: Reader[] = [
  // npm's `"resolved": "..."`, yarn v1's `resolved "..."`, yarn berry's `resolution: "pkg@https://..."`,
  // and pnpm's `tarball: ...` and `repo: ...`.
  {
    files: /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
    urls: firstUrl(/\b(?:resolved|resolution|tarball|repo)["']?\s*[:\s]\s*\{?\s*["']?(?:@?[^"'\s@]+@)?((?:git\+)?[a-z][\w+.-]*:\/\/[^\s"'#,}]+)/i)
  },
  { files: /(?:^|\/)poetry\.lock$/i, urls: firstUrl(quotedUrl("url")) },
  { files: /(?:^|\/)Pipfile\.lock$/i, urls: firstUrl(quotedUrl("url")) },
  { files: /(?:^|\/)Cargo\.lock$/i, urls: firstUrl(/^\s*source\s*=\s*"((?:registry\+|sparse\+|git\+)?[a-z][\w+.-]*:\/\/[^"]+)"/i) },
  { files: /(?:^|\/)Gemfile\.lock$/i, urls: firstUrl(/^\s*remote:\s*([a-z][\w+.-]*:\/\/\S+)/i) },
  { files: /(?:^|\/)\.npmrc$/i, urls: firstUrl(/^\s*(?:@[\w.-]+:)?registry\s*=\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  { files: /(?:^|\/)\.yarnrc\.yml$/i, urls: firstUrl(/^\s*npmRegistryServer:\s*["']?([a-z][\w+.-]*:\/\/[^\s"']+)/i) },
  {
    files: /(?:^|\/)(?:requirements[^/]*|requirements\/[^/]+)\.(?:txt|in)$|(?:^|\/)pip\.conf$/i,
    urls: (content) => {
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
  const gemfile = /Gemfile\.lock$/i.test(path);
  let section = "";
  const found: LockfileSource[] = [];

  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    // Gemfile.lock sections start at the first column; git shows the current one after `@@`.
    if (gemfile) {
      if (startsHunk) {
        section = /^[A-Z]+$/.exec(hunkContext?.trim() ?? "")?.[0] ?? "";
      }
      if (/^[A-Z]+$/.test(content)) {
        section = content;
      }
    }
    if (!added) {
      continue;
    }

    for (const { url, extraIndex } of reader.urls(content)) {
      const source = extraIndex ? { kind: "extra-index" as const } : classify(url, allowed, section === "GIT");
      if (source !== undefined) {
        found.push({ line, ...source });
      }
    }
  }

  return found;
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
