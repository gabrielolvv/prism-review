import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

const downloader = String.raw`(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString)`;
// Interpreters only run stdin with no arguments or `-`; with `-m`, `-c`, or `-e` they read it as data.
const shell = String.raw`(?:(?:(?:ba|z|da|k)?sh|iex|Invoke-Expression)\b|(?:python[23]?|node|perl|ruby)(?:\s+-)?\s*(?:$|[;&|)]))`;

// Each pattern runs downloaded content without saving it, so nothing can check it first.
const patterns = [
  // `curl ... | sh`, `wget -qO- ... | sudo -E bash -`, `... | sudo env A=1 bash`, `irm ... | iex`
  new RegExp(String.raw`\b${downloader}\b[^|;&\n]*\|\s*(?:sudo\s+(?:-\S+\s+)*)?(?:env\s+(?:-\S+\s+|\w+=\S*\s+)*)?${shell}`, "i"),
  // `bash <(curl ...)`, `source <(curl ...)`
  /(?:^|[\s;&|(])(?:source|\.|(?:ba|z|k)?sh)\s+(?:-s\s+)?<\(\s*(?:curl|wget)\b/i,
  // `sh -c "$(curl ...)"`, `eval "$(curl ...)"`
  /\b(?:eval|(?:ba|z|k)?sh\s+-c)\s+["']?\$\(\s*(?:curl|wget)\b/i,
  // `iex (iwr ...)`, `iex ((New-Object Net.WebClient).DownloadString(...))`
  new RegExp(String.raw`\b(?:iex|Invoke-Expression)\s*\(+\s*(?:New-Object\b[^)]*\)\.)?${downloader}\b`, "i")
];

const commentLine = /^\s*(?:#|\/\/|REM\b|::)/i;
// Installation guides show these commands on purpose.
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const firstUrl = /\b(https?):\/\/([^\s"'|)/:\\]+)/i;

export const remoteScriptRule: Rule = {
  id: "remote-script",
  description: "Flags commands that download a script and run it without checking it, such as curl | sh.",
  run({ files, config }) {
    if (!config.rules.remoteScripts.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = commands(file.patch).flatMap(({ line, content }) => {
        if (!patterns.some((pattern) => pattern.test(unquoted(content)))) {
          return [];
        }
        const url = firstUrl.exec(content);
        return [{ line, host: url?.[2]?.toLowerCase(), insecure: url?.[1]?.toLowerCase() === "http" }];
      });
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found.map((match) => match.line));
      const hosts = [...new Set(found.flatMap((match) => match.host ?? []))];
      const sources = [
        ...hosts.slice(0, 3),
        ...(hosts.length > 3 ? ["..."] : []),
        ...(found.some((match) => match.host === undefined) ? ["a URL in a variable"] : [])
      ].join(", ");
      const insecure = found.filter((match) => match.insecure).map((match) => match.line);
      const http = insecure.length > 0 ? `, and ${describeInsecure(insecure)} over plain HTTP` : "";

      return [
        {
          ruleId: "remote-script",
          title: "Downloaded script runs unchecked",
          severity: insecure.length > 0 ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "run scripts" : "runs a script"} downloaded from ${sources} without checking ${plural ? "them" : "it"}${http}.`,
          recommendation:
            "Whoever controls the URL, or can intercept it, runs code here. Download the script to a file, check its checksum or signature, then run it, or install a pinned release from a package manager."
        }
      ];
    });
  }
};

// Joins lines continued with a trailing `\`, as long Dockerfile RUN commands are written, and keeps
// the commands this patch adds to or changes, numbered by their first added line.
function commands(patch: string): Array<{ line: number; content: string }> {
  const result: Array<{ line: number; content: string }> = [];
  let parts: string[] = [];
  let firstAdded: number | undefined;
  const flush = () => {
    if (firstAdded !== undefined) {
      result.push({ line: firstAdded, content: parts.join(" ") });
    }
    parts = [];
    firstAdded = undefined;
  };

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      flush();
    }
    // A comment never continues a line, and Docker drops comments inside a continued instruction.
    if (commentLine.test(content)) {
      continue;
    }
    const continues = /\\\s*$/.test(content);
    parts.push(continues ? content.replace(/\\\s*$/, "") : content);
    if (added && firstAdded === undefined) {
      firstAdded = line;
    }
    if (!continues) {
      flush();
    }
  }
  flush();

  return result;
}

// "line 4 downloads" or "lines 4, 9 download", to follow the first sentence.
function describeInsecure(lines: number[]): string {
  const { text, plural } = describeLines(lines);
  return `${text.charAt(0).toLowerCase()}${text.slice(1)} ${plural ? "download" : "downloads"}`;
}

// Single-quoted strings never run, and double-quoted ones only through `$(...)`, so
// `echo 'curl ... | sh'` does not count while `sh -c "$(curl ...)"` does.
function unquoted(content: string): string {
  return content.replace(/'[^']*'/g, "''").replace(/"[^"$]*"/g, '""');
}
