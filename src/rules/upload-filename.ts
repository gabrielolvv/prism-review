import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Where each framework keeps the name the client gave an uploaded file, the calls that write a file
// or build its path, and the functions that reduce a name to something safe.
type Language = {
  files: RegExp;
  // The client's name for an upload. `{upload}` stands for a name that holds an upload, when the
  // property alone is too common to count, as `.filename` is in Python.
  clientName: RegExp;
  // Names that hold an upload, as in `file = request.files["avatar"]`.
  upload?: RegExp;
  sink: RegExp;
  guard: RegExp;
};

const languages: Language[] = [
  {
    // Flask and Werkzeug. Django's `request.FILES` is a request value that untrusted-input reads.
    files: /\.py$/i,
    clientName: /\{upload\}\.filename\b|\brequest\.files\s*(?:\[[^\]]*\]|\.get\s*\([^)]*\))\s*\.filename\b/,
    upload: /^\s*(?:for\s+)?([A-Za-z_]\w*)\s*(?:=|in)\s*request\.files\b/,
    sink: /\.save\s*\(|\bos\.path\.join\s*\(|\bopen\s*\(|\bPath\s*\(|\bshutil\.(?:move|copy\w*)\s*\(|\bos\.(?:rename|replace)\s*\(|\/\s*[A-Za-z_]\w*\.filename\b/,
    guard: /\bsecure_filename\s*\(|\buuid\w*\s*\(|\bos\.path\.basename\s*\(|\bget_valid_filename\s*\(/
  },
  {
    // multer's `originalname`, and express-fileupload's `req.files.<field>.name`.
    files: /\.(?:[cm]?[jt]sx?)$/i,
    clientName: /\.originalname\b|\breq\.files(?:\.\w+|\[[^\]]+\])\.name\b|\{upload\}\.name\b/,
    upload: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*req\.files\b/,
    sink: /\bpath\.(?:join|resolve)\s*\(|\bfs(?:\.promises)?\.(?:writeFile|writeFileSync|createWriteStream|rename|renameSync|copyFile|copyFileSync)\s*\(|\.mv\s*\(|\bcb\s*\(\s*null\s*,|\bcallback\s*\(\s*null\s*,/,
    guard: /\bpath\.basename\s*\(|\bsanitize\w*\s*\(|\b(?:uuid|randomUUID|nanoid|randomBytes)\w*\s*\(|\bDate\.now\s*\(/
  },
  {
    files: /\.php$/i,
    clientName: /\$_FILES\s*\[[^\]]+\]\s*\[\s*["']name["']\s*\]|->getClientOriginalName\s*\(\s*\)/,
    sink: /\bmove_uploaded_file\s*\(|\bcopy\s*\(|\bfile_put_contents\s*\(|\bfopen\s*\(|->(?:move|storeAs)\s*\(/,
    guard: /\bbasename\s*\(|\bpathinfo\s*\(|\buniqid\s*\(|\brandom_bytes\s*\(|\bStr::(?:random|uuid)\s*\(|->hashName\s*\(/
  },
  {
    // Spring's MultipartFile and the Servlet API's Part.
    files: /\.(?:java|kt)$/i,
    clientName: /\.(?:getOriginalFilename|getSubmittedFileName)\s*\(\s*\)|\.originalFilename\b/,
    sink: /\bnew\s+File\s*\(|\b(?:Paths\.get|Path\.of)\s*\(|\.resolve\s*\(|\.transferTo\s*\(|\bFiles\.(?:copy|write|move)\s*\(|\bnew\s+FileOutputStream\s*\(/,
    guard: /\bFilenameUtils\.getName\s*\(|\.getFileName\s*\(\s*\)|\bUUID\.randomUUID\s*\(|\bsanitize\w*\s*\(/
  },
  {
    // multipart.FileHeader, from `r.FormFile` or `r.MultipartForm.File`.
    files: /\.go$/i,
    clientName: /\.Filename\b/,
    sink: /\bos\.(?:Create|OpenFile|WriteFile|Rename)\s*\(|\bfilepath\.Join\s*\(|\bpath\.Join\s*\(|\.SaveUploadedFile\s*\(/,
    guard: /\bfilepath\.Base\s*\(|\bpath\.Base\s*\(|\buuid\.\w+\s*\(/
  },
  {
    // ASP.NET Core's IFormFile.
    files: /\.cs$/i,
    clientName: /\{upload\}\.FileName\b|\bRequest\.Form\.Files\s*\[[^\]]+\]\s*\.FileName\b/,
    upload: /\bIFormFile\w*\s*(?:<[^>]*>)?\s+([A-Za-z_]\w*)|\bforeach\s*\(\s*(?:var|IFormFile)\s+([A-Za-z_]\w*)\s+in\s+(?:Request\.Form\.Files|\w*[fF]iles)\b/,
    sink: /\bPath\.Combine\s*\(|\bFile\.(?:Create|OpenWrite|WriteAllBytes|Move|Copy)\s*\(|\bnew\s+FileStream\s*\(/,
    guard: /\bPath\.GetFileName\s*\(|\bPath\.GetRandomFileName\s*\(|\bGuid\.NewGuid\s*\(/
  },
  {
    // Rails and Rack uploads.
    files: /\.rb$/i,
    clientName: /\.original_filename\b/,
    sink: /\bFile\.(?:join|open|write|rename)\b|\bFileUtils\.(?:mv|cp|move|copy)\b|\bRails\.root\.join\b|\bIO\.copy_stream\b/,
    guard: /\bFile\.basename\s*\(|\bsanitize\w*|\bSecureRandom\.\w+/
  }
];

// Taking what follows the last slash by hand, as Tomcat's manager does with
// `filename.substring(filename.lastIndexOf('/') + 1)`, or `name.split("/").pop()`.
const manualBasename = /\blastIndexOf\s*\(\s*['"](?:\/|\\\\)['"]|\.split\s*\(\s*['"][/\\\\]+['"]\s*\)\s*(?:\.pop\s*\(|\[\s*-1\s*\])|\.rsplit\s*\(\s*['"]\/['"]/;

const assignment = /^\s*(?:(?:const|let|var|final|String|string|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*)$/;
// How far, in lines, a name holding the client's file name is followed.
const reach = 20;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const uploadFilenameRule: Rule = {
  id: "upload-filename",
  description: "Flags uploaded files saved or placed under the file name the client sent.",
  run({ files, config }) {
    if (!config.rules.uploadFilename.enabled) {
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

      const lines = findUnsafeSaves(file.patch, language);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "upload-filename",
          title: "Upload saved under the client's file name",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "save uploads under" : "saves an upload under"} the file name the client sent, which can hold \`../\` to leave the upload directory, overwrite another file, or end in \`.php\` or \`.html\` so the server runs or serves it.`,
          recommendation:
            "Store uploads under a name the server makes, such as a UUID, and keep the original name only as data. If the name must be kept, reduce it with `secure_filename`, `path.basename`, `basename`, `FilenameUtils.getName`, `filepath.Base`, or `Path.GetFileName`, and check its extension against a list of allowed types."
        }
      ];
    });
  }
};

function findUnsafeSaves(patch: string, language: Language): number[] {
  const uploads = new Set<string>();
  // Names holding the client's file name, with the line they were assigned on.
  const names = new Map<string, number>();
  const found: number[] = [];

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const upload = language.upload?.exec(content);
    const uploadName = upload?.[1] ?? upload?.[2];
    if (uploadName !== undefined) {
      uploads.add(uploadName);
    }

    const holdsClientName = (text: string) =>
      clientNamePattern(language, uploads).test(text) ||
      [...names].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));

    const guarded = (text: string) => language.guard.test(text) || manualBasename.test(text);
    if (added && !guarded(content) && language.sink.test(content)) {
      const afterSink = content.slice(content.search(language.sink));
      if (holdsClientName(afterSink)) {
        found.push(line);
      }
    }

    const assigned = assignment.exec(content);
    if (assigned?.[1] !== undefined) {
      if (!guarded(assigned[2] ?? "") && holdsClientName(assigned[2] ?? "")) {
        names.set(assigned[1], line);
      } else {
        names.delete(assigned[1]);
      }
    }
  }
  return found;
}

function clientNamePattern(language: Language, uploads: Set<string>): RegExp {
  const names = [...uploads].map((name) => name.replace(/\$/g, "\\$"));
  const source = language.clientName.source.replace(/\\\{upload\\\}/g, names.length === 0 ? "(?!)" : `(?<![\\w$.])(?:${names.join("|")})`);
  return new RegExp(source);
}
