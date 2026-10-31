import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "join" | "tar";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  join: [
    "builds a path from an archive entry's name without checking that it stays in the destination",
    "build paths from archive entry names without checking that they stay in the destination"
  ],
  tar: ["extracts a tar archive without a `filter`", "extract tar archives without a `filter`"]
};

type Language = {
  files: RegExp;
  // The name an archive gives an entry, as in `entry.fileName` or `f.Name`.
  entryName: RegExp;
  // Loop variables that hold an entry's name, as in `for name in zf.namelist():`.
  nameLoop?: RegExp;
  // Calls that build or open a path.
  sink: RegExp;
  // Archive APIs. Without one in the patch, `entry.path` or `f.Name` is too common to count.
  archive: RegExp;
  // Python's tarfile, whose `extractall` needs a filter.
  tarfile?: boolean;
};

const languages: Language[] = [
  {
    // adm-zip's `entryName`, and unzipper's and tar-stream's `entry.path` and `header.name`. yauzl
    // rejects `..` and absolute paths in `entry.fileName` itself.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    entryName: /\b(?:\w*[eE]ntry|header|hdr)\.(?:path|entryName|name)\b|\.entryName\b/,
    sink: /\b(?:path|pth|nodePath|upath)(?:\.posix|\.win32)?\.(?:join|resolve)\s*\(|\bfs(?:\.promises)?\.(?:writeFile|writeFileSync|createWriteStream|mkdir|mkdirSync)\s*\(/,
    archive:
      /\b(?:yauzl|unzipper|adm-zip|AdmZip|jszip|JSZip|tar-stream|node-stream-zip|StreamZip|decompress|extract-zip|zip-lib|unzip|untar|extractAllTo)\b|\.(?:readEntry|getEntries)\s*\(|\.on\s*\(\s*['"]entry['"]/
  },
  {
    // tarfile's `member.name` and zipfile's `info.filename`, and the names `namelist()` and `getnames()` list.
    files: /\.py$/i,
    entryName: /\b(?:\w*(?:member|info|entry)|m|ti|zi)\.(?:name|filename)\b/,
    nameLoop: /^\s*for\s+([A-Za-z_]\w*)\s+in\s+[\w.]+\.(?:namelist|getnames)\s*\(\s*\)/,
    // `open(...)`, but not `zf.open(name)`, which reads the entry.
    sink: /\bos\.path\.join\s*\(|(?<![.\w])open\s*\(|\bPath\s*\(|\.joinpath\s*\(/,
    archive: /\b(?:tarfile|zipfile|TarFile|ZipFile|TarInfo|ZipInfo|namelist|getmembers|infolist|getnames)\b/,
    tarfile: true
  },
  {
    // A `*zip.File` or a `*tar.Header`, as in `for _, f := range r.File`.
    files: /\.go$/i,
    entryName: /\b(?:f|file|zf|zipFile|hdr|header|h|th|entry|fh)\.Name\b/,
    sink: /\bfilepath\.Join\s*\(|\bpath\.Join\s*\(|\bos\.(?:Create|OpenFile|MkdirAll|Mkdir|WriteFile)\s*\(/,
    archive: /\barchive\/(?:zip|tar)\b|\b(?:zip|tar)\.(?:File|Header|Reader|NewReader|OpenReader|FileHeader)\b/
  },
  {
    // `ZipEntry.getName()`, and zip4j's `FileHeader.getFileName()`. Paths are also built by hand,
    // with `File.separator`.
    files: /\.(?:java|kt)$/i,
    entryName: /\b\w*(?:[eE]ntry|ze)\.(?:getName\s*\(\s*\)|name\b)|\b\w*[hH]eader\.getFileName\s*\(\s*\)/,
    sink: /\bnew\s+File\s*\(|\b(?:Paths\.get|Path\.of)\s*\(|\.resolve(?:File)?\s*\(|\bnew\s+FileOutputStream\s*\(|\bFile\s*\(|\bFile\.separator\b|"file\.separator"/,
    archive:
      /\b(?:ZipEntry|ZipInputStream|ZipFile|JarEntry|JarFile|JarInputStream|TarArchiveEntry|ArchiveEntry|ZipArchiveEntry|ArchiveInputStream|getNextEntry|getNextTarEntry|getNextJarEntry)\b|\bjava\.util\.zip\b|\b\w*U[nN][aA]rchiver\b/
  },
  {
    // System.IO.Compression's `entry.FullName`, and SharpCompress's `entry.Key`.
    files: /\.cs$/i,
    entryName: /\b\w*[eE]ntry\w*\.(?:FullName|Name|Key)\b/,
    sink: /\bPath\.Combine\s*\(|\bFile\.(?:Create|OpenWrite|WriteAllBytes)\s*\(|\.ExtractToFile\s*\(|\bnew\s+FileStream\s*\(/,
    archive: /\b(?:ZipArchive|ZipArchiveEntry|ZipFile|IArchiveEntry|TarEntry|ZipEntry|SharpCompress|SharpZipLib|System\.IO\.Compression)\b/
  },
  {
    // rubyzip and RubyGems' tar reader.
    files: /\.(?:rb|rake)$/i,
    entryName: /\b\w*entry\w*\.(?:name|full_name)\b/,
    sink: /\bFile\.(?:join|expand_path|open|write)\b|\bFileUtils\.mkdir_p\b|\.extract\s*\(/,
    archive: /\b(?:Zip::File|Zip::InputStream|Zip::Entry|Gem::Package|Archive::Tar|Minitar|TarReader)\b/
  }
];

// A check that the path stays in the destination, or a call that does one: `startsWith`, Go's
// `strings.HasPrefix`, `getCanonicalPath`, `path.relative`, `is_relative_to`, a `..` test, or a
// helper such as `sanitizeExtractPath` or pip's `is_within_directory`.
const containment =
  /\.start[sS]with\s*\(|\bHasPrefix\s*\(|\bStartsWith\s*\(|\bstart_with\?|\.indexOf\s*\([^)]*\)\s*(?:!==?|===?|<|>|<=|>=)\s*0\b|\b(?:getCanonicalPath|getCanonicalFile|toRealPath)\b|\b(?:path\.relative|filepath\.Rel|os\.path\.(?:commonpath|commonprefix|realpath)|is_relative_to|relative_to|filepath\.IsLocal|SecureJoin)\s*\(|["']\.\.["']|\.\.\/|\b\w*(?:[sS]anitiz|[sS]afe[A-Z_]|[sS]ecure|[wW]ithin|[iI]nside|[iI]llegal|[tT]raversal|[sS]lip|[iI]sLocal|[dD]ot[dD]ot|[sS]ubpath)\w*\s*\(/;
// Helpers named for the check, such as archiver's `CheckPath`, distlib's `check_path`, or Django's
// `target_filename`.
const checkHelper = /\b\w*(?:check|validat|verify|target)\w*(?:path|name|entry)\w*\s*\(/i;
// Reducing the name to its last part, or joining it below `/` first, which drops any `..`.
const reduced =
  /\b(?:path\.basename|basename|filepath\.Base|path\.Base|Path\.GetFileName|File\.basename|os\.path\.basename|FilenameUtils\.getName)\s*\(|\b(?:path|pth)(?:\.posix)?\.join\s*\(\s*['"]\/['"]\s*,|\bfilepath\.Join\s*\(\s*"\/"/;
// A variable or parameter named for an entry's name, as in plexus-archiver's `resolveFile(dir, entryName)`.
const entryNameVariable = /\b(?:entry_?[nN]ame|entryPath|entry_path|zipEntryName|archiveEntryName)\b/;
// How far, in lines, a check before or after the path is looked for, and a name is followed.
const before = 30;
const after = 12;

// Python's tarfile writes `../` and absolute paths, and links, as they are until 3.14, unless a
// `filter` is given. zipfile drops them itself, so only tar archives count: names opened with
// `tarfile.open`, names such as `tar` and `tf`, and `tarfile.open(...).extractall()`.
const tarOpen = /\b([A-Za-z_]\w*)\s*=\s*tarfile\.open\s*\(|\btarfile\.open\s*\(.*\)\s+as\s+([A-Za-z_]\w*)/;
const tarNames = /^(?:tar|tf|tarball|tar_file|tarf)$/;
const tarExtract = /(?:\b([A-Za-z_]\w*)|\btarfile\.open\s*\([^)]*\))\.extract(?:all)?\s*\(/;

const assignment = /^\s*(?:(?:const|let|var|final|String|string|val)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
// Copies of tarfile itself, as setuptools vendors, which apply the filters elsewhere.
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|(?:^|\/)tarfile(?:\.py|\/__init__\.py)$/i;
const maxLineLength = 1_000;

export const zipSlipRule: Rule = {
  id: "zip-slip",
  description: "Flags archive entries written to a path built from their own name without checking that it stays in the destination.",
  run({ files, config }) {
    if (!config.rules.zipSlip.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (
        language === undefined ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      if (!lines.some(({ content }) => language.archive.test(content))) {
        return [];
      }
      const found = [
        ...findJoins(lines, language),
        ...(language.tarfile ? findTarExtracts(lines) : [])
      ].sort((left, right) => left.line - right.line);
      if (found.length === 0) {
        return [];
      }

      const numbers = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "zip-slip",
          title: "Archive entry path not checked",
          severity: "warning" as const,
          file: file.path,
          line: numbers[0],
          lines: numbers,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, so an entry named \`../../etc/cron.d/job\` or with an absolute path writes outside it (Zip Slip).`,
          recommendation:
            "Resolve each entry's path and check that it starts with the destination directory plus a separator before writing, as in `path.resolve(dest, name).startsWith(path.resolve(dest) + path.sep)`, Go's `filepath.IsLocal`, or Java's `toPath().normalize().startsWith(dest)`, and skip links that point outside it. With Python's tarfile, pass `filter=\"data\"`."
        }
      ];
    });
  }
};

function findJoins(lines: PatchLine[], language: Language): Array<{ line: number; kind: Kind }> {
  // Names holding an entry's name, with the index of the line they were assigned on.
  const names = new Map<string, number>();
  const found: Array<{ line: number; kind: Kind }> = [];

  lines.forEach(({ line, content, added }, index) => {
    if (content.length > maxLineLength || commentLine.test(content)) {
      return;
    }
    const holdsEntryName = (text: string) =>
      language.entryName.test(text) ||
      entryNameVariable.test(text) ||
      [...names].some(([name, at]) => index - at <= before && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));

    const loop = language.nameLoop?.exec(content)?.[1];
    if (loop !== undefined) {
      names.set(loop, index);
    }
    if (added && !reduced.test(content) && language.sink.test(content)) {
      const afterSink = content.slice(content.search(language.sink));
      if (holdsEntryName(afterSink) && !checkedNearby(lines, index)) {
        found.push({ line, kind: "join" });
      }
    }

    const assigned = assignment.exec(content);
    if (assigned?.[1] !== undefined && assigned[1] !== loop) {
      const value = assigned[2] ?? "";
      // A path built next to a check, as in go-getter's `containsDotDot(hdr.Name)`, is safe to follow.
      if (!reduced.test(value) && !checkHelper.test(value) && holdsEntryName(value) && !checkedNearby(lines, index)) {
        names.set(assigned[1], index);
      } else {
        names.delete(assigned[1]);
      }
    }
  });
  return found;
}

// A containment check in the same hunk, shortly before or after the path is built.
function checkedNearby(lines: PatchLine[], index: number): boolean {
  for (let other = index; other >= Math.max(0, index - before); other -= 1) {
    if (isCheck(lines[other]?.content ?? "")) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  for (let other = index + 1; other < Math.min(lines.length, index + 1 + after); other += 1) {
    if (lines[other]?.startsHunk) {
      break;
    }
    if (isCheck(lines[other]?.content ?? "")) {
      return true;
    }
  }
  return false;
}

function isCheck(content: string): boolean {
  return containment.test(content) || checkHelper.test(content);
}

function findTarExtracts(lines: PatchLine[]): Array<{ line: number; kind: Kind }> {
  // distlib sets `archive.extraction_filter`, which applies to every extraction.
  if (!lines.some(({ content }) => /\btarfile\b/.test(content)) || lines.some(({ content }) => /\.extraction_filter\s*=/.test(content))) {
    return [];
  }
  const opened = new Set<string>();
  return lines.flatMap(({ line, content, added }, index) => {
    const open = tarOpen.exec(content);
    if (open !== null) {
      opened.add(open[1] ?? open[2] ?? "");
    }
    const extract = tarExtract.exec(content);
    const receiver = extract?.[1];
    if (
      !added ||
      extract === null ||
      commentLine.test(content) ||
      (receiver !== undefined && !opened.has(receiver) && !tarNames.test(receiver)) ||
      checkedNearby(lines, index)
    ) {
      return [];
    }
    // The call's arguments can continue on the next lines.
    const call = [content, ...lines.slice(index + 1, index + 4).map((next) => next.content)].join("\n");
    return /\bfilter\s*=/.test(argumentsOf(call, extract.index + extract[0].length)) ? [] : [{ line, kind: "tar" as const }];
  });
}

// The text up to the parenthesis that closes a call opened just before `start`.
function argumentsOf(text: string, start: number): string {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index);
      }
    }
  }
  return text.slice(start);
}
