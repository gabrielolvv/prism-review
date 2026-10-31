import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "name" | "fixed";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  name: ["makes a temporary file name without creating the file", "make temporary file names without creating the files"],
  fixed: ["writes to a fixed path in /tmp", "write to fixed paths in /tmp"]
};

// Functions that return a name for a temporary file and leave creating it to the caller, so another
// user can create the file, or a symbolic link with its name, first.
const nameOnly: Array<{ files: RegExp; pattern: RegExp }> = [
  { files: /\.py$/i, pattern: /\btempfile\.mktemp\s*\(|\bos\.(?:tempnam|tmpnam)\s*\(/ },
  // C and C++, but not declarations or the _s variants.
  { files: /\.(?:c|h|cc|cpp|cxx|hpp|hh|m|mm)$/i, pattern: /(?<![\w.>:])(?:tmpnam|tempnam|mktemp)\s*\((?!\s*(?:const\s+)?char\s*\*|\s*void\s*\))/ },
  // `mktemp -u` and `--dry-run` print a name without creating the file.
  { files: /\.(?:sh|bash|zsh|ya?ml)$|(?:^|\/)(?:Dockerfile[^/]*|Makefile|[^/]*\.mk)$/i, pattern: /\bmktemp\b[^|;&)\n]*?(?:\s-[a-zA-Z]*u[a-zA-Z]*\b|\s--dry-run\b)/ },
  { files: /\.rb$/i, pattern: /\bDir::Tmpname\.make_tmpname\b/ }
];

// Python's `from tempfile import mktemp`, after which a bare mktemp() is the same function.
const pythonImport = /^\s*from\s+tempfile\s+import\s+[^#\n]*\bmktemp\b/;
const pythonBare = /(?<![.\w])mktemp\s*\(/;

// A file in /tmp named by the code, which another user on the machine can create first.
const fixedTmp = String.raw`["'\`]/tmp/(?![^"'\`]*\$\{)[^"'\`]+["'\`]`;
const fixedWrites: Array<{ files: RegExp; pattern: RegExp }> = [
  { files: /\.py$/i, pattern: new RegExp(String.raw`\bopen\s*\(\s*${fixedTmp}\s*,\s*(?:mode\s*=\s*)?["'][^"']*[wax]`) },
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: new RegExp(String.raw`\bfs(?:\.promises)?\.(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(\s*${fixedTmp}`) },
  { files: /\.go$/i, pattern: /\b(?:os\.(?:Create|WriteFile|OpenFile)|ioutil\.WriteFile)\s*\(\s*"\/tmp\/[^"]+"/ },
  { files: /\.(?:java|kt)$/i, pattern: /\bnew\s+(?:FileOutputStream|FileWriter|PrintWriter)\s*\(\s*"\/tmp\/[^"]+"/ },
  { files: /\.rb$/i, pattern: /\bFile\.write\s*\(\s*["']\/tmp\/[^"'#]+["']|\bFile\.open\s*\(\s*["']\/tmp\/[^"'#]+["']\s*,\s*["'][wa]/ },
  // A name made from the process ID, as in `/tmp/build.$$`, which another user can guess.
  { files: /\.(?:sh|bash|zsh)$/i, pattern: /\/tmp\/[\w.-]*\$\$/ }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const insecureTempFileRule: Rule = {
  id: "insecure-temp-file",
  description: "Flags temporary file names made without creating the file, such as tempfile.mktemp(), tmpnam(), and mktemp -u, and writes to fixed paths in /tmp.",
  run({ files, config }) {
    if (!config.rules.insecureTempFile.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const names = nameOnly.filter(({ files: pattern }) => pattern.test(file.path));
      const writes = fixedWrites.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (names.length === 0 && writes.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const python = /\.py$/i.test(file.path);
      const importsMktemp = python && lines.some(({ content }) => pythonImport.test(content));
      const found: Array<{ line: number; kind: Kind }> = [];
      // Python docstrings show these as examples.
      let inDocstring = false;
      for (const { line, content, added, startsHunk } of lines) {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        if (names.some(({ pattern }) => pattern.test(content)) || (importsMktemp && pythonBare.test(content) && !pythonImport.test(content))) {
          found.push({ line, kind: "name" });
        }
        if (writes.some(({ pattern }) => pattern.test(content))) {
          found.push({ line, kind: "fixed" });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      return [
        {
          ruleId: "insecure-temp-file",
          title: "Predictable temporary file",
          severity: "warning" as const,
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, so another user on the machine can create that file, or a symbolic link with its name, first, and read what the program writes or make it overwrite another file.`,
          recommendation:
            "Create the file and its name together: `tempfile.NamedTemporaryFile()` or `mkstemp()` in Python, `mkstemp()` in C, `mktemp` without `-u` in shell, `os.CreateTemp` in Go, `Files.createTempFile` in Java, `Tempfile` in Ruby, or `fs.mkdtemp` in Node.js, and write inside a directory made that way instead of a fixed path in /tmp."
        }
      ];
    });
  }
};
