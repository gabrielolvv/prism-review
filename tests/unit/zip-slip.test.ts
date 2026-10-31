import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { zipSlipRule } from "../../src/rules/zip-slip.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return zipSlipRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testZipSlipReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/unpack.py", [
      "import tarfile, zipfile",
      "with zipfile.ZipFile(upload) as zf:",
      "    for info in zf.infolist():",
      "        target = os.path.join(dest, info.filename)",
      "with tarfile.open(bundle) as tar:",
      "    tar.extractall(dest)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Archive entry path not checked");
  assert.deepEqual(finding?.lines, [4, 6]);
  assert.equal(
    finding?.message,
    "Lines 4, 6 build paths from archive entry names without checking that they stay in the destination, and extract tar archives without a `filter`, so an entry named `../../etc/cron.d/job` or with an absolute path writes outside it (Zip Slip)."
  );
}

export function testZipSlipReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/extract.js", ["const unzipper = require('unzipper');", "zip.on('entry', (entry) => {", "  entry.pipe(fs.createWriteStream(path.join(opts.path, entry.path)));"]],
    ["src/extract.js", ["const AdmZip = require('adm-zip');", "for (const entry of zip.getEntries()) {", "  const entryName = pth.normalize(entry.entryName);", "  fs.writeFileSync(pth.resolve(targetPath, entryName), entry.getData());"]],
    ["unzip.go", ['import "archive/zip"', "for _, f := range r.File {", "\tpath := filepath.Join(dest, f.Name)", "\tout, _ := os.Create(path)"]],
    ["untar.go", ['import "archive/tar"', "hdr, _ := tr.Next()", "target := filepath.Join(dest, hdr.Name)"]],
    ["src/Unzip.java", ["ZipEntry entry = zis.getNextEntry();", "File file = new File(outputDir, entry.getName());"]],
    ["src/Unzip.java", ["import java.util.zip.ZipEntry;", "String name = entry.getName();", "Path target = dest.resolve(name);"]],
    ["src/Unzip.cs", ["using System.IO.Compression;", "foreach (ZipArchiveEntry entry in archive.Entries)", "  entry.ExtractToFile(Path.Combine(dest, entry.FullName));"]],
    ["lib/unpack.rb", ["Zip::File.open(path) do |zip_file|", "  zip_file.each { |entry| entry.extract(File.join(dest, entry.name)) }"]],
    ["app/unpack.py", ["with zipfile.ZipFile(path) as zf:", "    for name in zf.namelist():", "        with open(os.path.join(dest, name), 'wb') as out:"]],
    ["app/unpack.py", ["archive = tarfile.open(path)", "archive.extractall(path=dest)"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testZipSlipSkipsCheckedPaths(): void {
  const cases: Array<[string, string[]]> = [
    // A check that the path stays in the destination, before or after it is built.
    ["src/extract.js", ["zip.on('entry', (entry) => {", "  const target = path.join(opts.path, entry.path);", "  if (target.indexOf(opts.path) != 0) return;"]],
    ["unzip.go", ['import "archive/zip"', "path := filepath.Join(dest, f.Name)", 'if !strings.HasPrefix(path, filepath.Clean(dest)+string(os.PathSeparator)) {']],
    ["unzip.go", ['import "archive/tar"', "if containsDotDot(hdr.Name) {", "\treturn err", "}", "path = filepath.Join(path, hdr.Name)", "os.MkdirAll(path, 0755)"]],
    ["src/Unzip.java", ["ZipEntry entry = zis.getNextEntry();", "File file = new File(outputDir, entry.getName());", "if (!file.getCanonicalPath().startsWith(outputDir.getCanonicalPath() + File.separator)) {"]],
    ["src/Unzip.cs", ["using System.IO.Compression;", "var target = Path.GetFullPath(Path.Combine(dest, entry.FullName));", "if (!target.StartsWith(dest, StringComparison.Ordinal)) throw new IOException();"]],
    ["app/unpack.py", ["with tarfile.open(path) as tar:", "    for member in tar.getmembers():", "        filename = self.target_filename(dest, member.name)", "        with open(filename, 'wb') as out:"]],
    // Only the last part of the name, or the name joined below `/` first.
    ["src/extract.js", ["const tar = require('tar-stream');", "const name = path.join(cwd, path.join('/', header.name));"]],
    ["unzip.go", ['import "archive/zip"', "out, _ := os.Create(filepath.Join(dest, filepath.Base(f.Name)))"]],
    // tar archives extracted with a filter, and zip archives, which zipfile checks itself.
    ["app/unpack.py", ["with tarfile.open(path) as tar:", "    tar.extractall(", "        path=str(dest),", "        filter='data',", "    )"]],
    ["app/unpack.py", ["import zipfile", "with zipfile.ZipFile(path) as zf:", "    zf.extractall(dest)"]],
    ["app/unpack.py", ["archive = tarfile.open(path)", "archive.extraction_filter = tarfile.data_filter", "archive.extractall(dest)"]],
    // Reading an entry is not writing it, and names without an archive in sight are other names.
    ["app/wheel.py", ["with zipfile.ZipFile(path) as zf:", "    with zf.open(info.filename) as entry:"]],
    ["src/routes.js", ["const target = path.join(root, entry.path);"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testZipSlipSkipsTestsAndCanBeDisabled(): void {
  const lines = ['import "archive/zip"', "path := filepath.Join(dest, f.Name)"];
  assert.deepEqual(findings([added("unzip_test.go", lines), added("testdata/unzip.go", lines), added("docs/unzip.md", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { zipSlip: { enabled: false } } });
  assert.deepEqual(findings([added("unzip.go", lines)], config), []);
}
