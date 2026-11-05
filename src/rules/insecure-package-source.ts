import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// A source over plain HTTP to a host other than this machine.
const httpRemote = String.raw`http:\/\/(?!localhost\b|127\.0\.0\.1\b|\[?::1\]?|0\.0\.0\.0\b|host\.docker\.internal\b)[\w.-]+`;

type Setting = { label: string; unsigned?: boolean; files: RegExp; pattern: RegExp; within?: RegExp };

// Files that install packages or configure where they come from.
const anyBuildFile =
  /(?:^|\/)(?:Dockerfile[^/]*|[^/]*\.dockerfile|Makefile|Jenkinsfile[^/]*|Procfile)$|\.(?:sh|bash|zsh|ps1|ya?ml|mk|env|toml|cfg|ini|conf|txt|in|json|xml|gradle|kts|repo|list|sources)$|(?:^|\/)(?:\.npmrc|\.yarnrc|pip\.conf|pip\.ini|Pipfile|Gemfile|go\.env|sources\.list)$/i;

const settings: Setting[] = [
  // Signature checks turned off: packages anyone on the path can replace.
  { label: "apt without signature checks", unsigned: true, files: anyBuildFile, pattern: /--allow-unauthenticated\b|--allow-insecure-repositories\b|\[[^\]]*\btrusted=yes\b[^\]]*\]|APT::Get::AllowUnauthenticated\s+["']?(?:true|1)|Acquire::AllowInsecureRepositories\s+["']?(?:true|1)|^\s*allow_unauthenticated\s*:\s*(?:true|yes|True)\b/ },
  { label: "yum or dnf without signature checks", unsigned: true, files: anyBuildFile, pattern: /^\s*gpgcheck\s*[=:]\s*(?:0|false|no)\b|--nogpgcheck\b|^\s*disable_gpg_check\s*:\s*(?:true|yes)\b/i },
  { label: "rpm without signature checks", unsigned: true, files: anyBuildFile, pattern: /\brpm\b[^|;&\n]*--no(?:signature|digest)\b/ },
  { label: "apk without signature checks", unsigned: true, files: anyBuildFile, pattern: /\bapk\b[^|;&\n]*--allow-untrusted\b/ },
  {
    label: "Go modules without checksum checks",
    unsigned: true,
    files: anyBuildFile,
    pattern: /\bGOSUMDB["']?\s*[=:]\s*["']?off\b|\bGONOSUMDB["']?\s*[=:]\s*["']?\*|\bGONOSUMCHECK["']?\s*[=:]\s*["']?1\b|\bGOFLAGS["']?\s*[=:]\s*["']?[^"'\n]*-insecure\b/
  },
  // Plain HTTP, or TLS without checking the server.
  { label: "Go modules over HTTP", files: anyBuildFile, pattern: /\bGOINSECURE["']?\s*[=:]\s*["']?[^\s"']+/ },
  {
    label: "pip over HTTP or without TLS checks",
    files: anyBuildFile,
    // Short flags only where pip reads them, so `curl -f http://...` is not mistaken for one.
    pattern: new RegExp(
      String.raw`--trusted-host[=\s]+\S+|^\s*trusted-host\s*=\s*\S+|(?:--(?:extra-)?index-url|--find-links)[=\s]+["']?${httpRemote}|^\s*-[if]\s+["']?${httpRemote}|\bpip3?\b[^|;&\n]*\s-[if]\s+["']?${httpRemote}|^\s*(?:extra-)?index-url\s*=\s*${httpRemote}`
    )
  },
  // Pipenv's and Poetry's sources, and uv's indexes.
  {
    label: "pip over HTTP or without TLS checks",
    files: /(?:^|\/)(?:Pipfile|pyproject\.toml|uv\.toml)$/i,
    pattern: new RegExp(String.raw`^\s*url\s*=\s*["']${httpRemote}`),
    within: /^\s*\[\[(?:source|tool\.poetry\.source|tool\.uv\.index|index)\]\]/
  },
  {
    label: "npm or Yarn over HTTP",
    files: /(?:^|\/)(?:\.npmrc|\.yarnrc(?:\.yml)?)$|(?:^|\/)Dockerfile[^/]*$|\.(?:sh|bash|ya?ml)$/i,
    pattern: new RegExp(String.raw`(?:^|\s|--)registry\s*[=\s]\s*["']?${httpRemote}|\bnpmRegistryServer\s*:\s*["']?${httpRemote}|\benableStrictSsl\s*:\s*false\b|\bunsafeHttpWhitelist\s*:`)
  },
  {
    label: "Maven repositories over HTTP",
    files: /(?:^|\/)(?:pom|settings)\.xml$/i,
    pattern: new RegExp(String.raw`<url>\s*${httpRemote}`),
    within: /<(?:repository|pluginRepository|mirror|snapshotRepository)\b/
  },
  { label: "Gradle repositories over HTTP", files: /\.gradle(?:\.kts)?$/i, pattern: /\b(?:isAllowInsecureProtocol|allowInsecureProtocol)\s*=?\s*true\b|\ballowInsecureProtocol\s*\(\s*true\s*\)/ },
  {
    label: "Docker registries over HTTP",
    files: /(?:^|\/)daemon\.json$|(?:^|\/)hosts\.toml$|\.(?:sh|service|ya?ml|toml|conf)$/i,
    pattern: /["']insecure-registries["']\s*:\s*\[\s*["']|--insecure-registry[=\s]+\S+|^\s*(?:insecure_skip_verify|skip_verify)\s*=\s*true\b|^\s*plain[-_]http\s*=\s*true\b/
  },
  {
    label: "NuGet over HTTP",
    files: /(?:^|\/)nuget\.config$|\.(?:props|targets|csproj)$/i,
    pattern: new RegExp(String.raw`<add\b[^>]*\bvalue\s*=\s*["']${httpRemote}|\ballowInsecureConnections\s*=\s*["']true["']`, "i")
  },
  { label: "Composer over HTTP or without TLS", files: /(?:^|\/)composer\.json$/i, pattern: /["']secure-http["']\s*:\s*false\b|["']disable-tls["']\s*:\s*true\b/ },
  { label: "RubyGems over HTTP", files: /(?:^|\/)(?:Gemfile|gems\.rb|\.gemrc)$|\.(?:sh|ya?ml)$|(?:^|\/)Dockerfile[^/]*$/i, pattern: new RegExp(String.raw`^\s*source\s+["']${httpRemote}|\bgem\b[^|;&\n]*--source[=\s]+["']?${httpRemote}`) },
  { label: "conda without TLS checks", files: /(?:^|\/)\.condarc$|\.(?:ya?ml|sh)$|(?:^|\/)Dockerfile[^/]*$/i, pattern: /^\s*ssl_verify\s*:\s*(?:false|False)\b|\bconda\s+config\b[^\n]*--set\s+ssl_verify\s+(?:false|no)\b/ }
];

// Maven's repository blocks, in the lines before a `<url>`.
const withinWindow = 6;

const commentLine = /^\s*(?:#|\/\/|;|<!--|\*)/;
// CI workflows and development setups install from throwaway mirrors, such as a local Verdaccio.
const ciOrTestSetup = /(?:^|\/)(?:\.devcontainer|molecule)(?:\/|$)|(?:^|\/)(?:docker-)?compose\.override\.ya?ml$/i;
const documentation = /\.(?:md|mdx|markdown|rst|adoc|asciidoc|html?)$|(?:^|\/)(?:README|CHANGELOG|CHANGES|HISTORY|NEWS|LICENSE)[^/]*$/i;
const maxLineLength = 2_000;

export const insecurePackageSourceRule: Rule = {
  id: "insecure-package-source",
  description: "Flags package managers set to skip signature or checksum checks, or to download packages over HTTP or without TLS checks.",
  run({ files, config }) {
    if (!config.rules.insecurePackageSource.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test setups install from local mirrors.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; label: string; unsigned: boolean }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const setting = fileSettings.find(
          ({ pattern, within }) =>
            pattern.test(content) &&
            (within === undefined || lines.slice(Math.max(0, index - withinWindow), index + 1).some(({ content: before }) => within.test(before)))
        );
        if (setting !== undefined) {
          found.push({ line, label: setting.label, unsigned: setting.unsigned === true });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "insecure-package-source",
          title: "Packages from an unchecked source",
          severity: found.some(({ unsigned }) => unsigned) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "install" : "installs"} packages without checking where they come from (${listOf(labels)}), so anyone on the network path, a hijacked mirror, or a poisoned cache can swap in a package that runs its code in the build and in the app.`,
          recommendation:
            "Keep signature and checksum checks on, such as `gpgcheck=1`, apt's signed-by keys, and the Go checksum database, and download over HTTPS with certificate checks, adding a private registry's CA instead of trusting its host. Pin dependencies with hashes or a lockfile where the package manager supports it."
        }
      ];
    });
  }
};
