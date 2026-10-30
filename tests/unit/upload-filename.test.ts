import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { uploadFilenameRule } from "../../src/rules/upload-filename.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return uploadFilenameRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUploadFilenameReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/upload.py", [
      "f = request.files['avatar']",
      "f.save(os.path.join(UPLOAD_DIR, f.filename))",
      "name = f.filename",
      "shutil.copy(tmp, os.path.join(BACKUP_DIR, name))"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Upload saved under the client's file name");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 save uploads under the file name the client sent, which can hold `../` to leave the upload directory, overwrite another file, or end in `.php` or `.html` so the server runs or serves it."
  );
}

export function testUploadFilenameReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/upload.js", ["const storage = multer.diskStorage({", "  filename: (req, file, cb) => cb(null, file.originalname),", "});"]],
    ["src/upload.js", ["const avatar = req.files.avatar;", "await avatar.mv(path.join(__dirname, 'uploads', avatar.name));"]],
    ["src/upload.ts", ["fs.writeFileSync(path.join(dir, req.file.originalname), req.file.buffer);"]],
    ["src/upload.php", ["move_uploaded_file($_FILES['f']['tmp_name'], 'uploads/' . $_FILES['f']['name']);"]],
    ["src/main/java/Upload.java", ["file.transferTo(new File(uploadDir, file.getOriginalFilename()));"]],
    ["src/main/java/Upload.java", ["String name = part.getSubmittedFileName();", "Files.copy(part.getInputStream(), Paths.get(UPLOADS, name));"]],
    ["internal/upload.go", ["dst, err := os.Create(filepath.Join(uploadDir, header.Filename))"]],
    ["Controllers/Upload.cs", ["public async Task<IActionResult> Upload(IFormFile file) {", "  var path = Path.Combine(_root, file.FileName);"]],
    ["app/controllers/uploads_controller.rb", ["File.open(Rails.root.join('public', 'uploads', params[:file].original_filename), 'wb') { |f| f.write(data) }"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUploadFilenameSkipsReducedAndGeneratedNames(): void {
  const cases: Array<[string, string[]]> = [
    // Names reduced to their last part, or made by the server.
    ["app/upload.py", ["f = request.files['avatar']", "f.save(os.path.join(UPLOAD_DIR, secure_filename(f.filename)))"]],
    ["app/upload.py", ["f = request.files['avatar']", "f.save(os.path.join(UPLOAD_DIR, f'{uuid4()}.png'))"]],
    ["src/upload.js", ["filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),"]],
    ["src/upload.js", ["filename: (req, file, cb) => cb(null, path.basename(file.originalname)),"]],
    ["src/upload.js", ["const name = req.file.originalname.split('/').pop();", "fs.writeFileSync(path.join(dir, name), buf);"]],
    ["src/upload.php", ["move_uploaded_file($_FILES['f']['tmp_name'], 'uploads/' . basename($_FILES['f']['name']));"]],
    ["src/main/java/Upload.java", ["String name = FilenameUtils.getName(file.getOriginalFilename());", "file.transferTo(new File(uploadDir, name));"]],
    [
      "src/main/java/Deploy.java",
      ["String filename = part.getSubmittedFileName();", "filename = filename.substring(filename.lastIndexOf('/') + 1);", "File file = new File(base, filename);"]
    ],
    ["internal/upload.go", ["dst, err := os.Create(filepath.Join(uploadDir, filepath.Base(header.Filename)))"]],
    ["Controllers/Upload.cs", ["public async Task<IActionResult> Upload(IFormFile file) {", "  var path = Path.Combine(_root, Path.GetRandomFileName());"]],
    // The name used as data, and names that are not an upload's.
    ["src/upload.js", ["res.json({ name: req.file.originalname });"]],
    ["app/logs.py", ["open(record.filename)"]],
    ["Controllers/Export.cs", ["var path = Path.Combine(_root, dialog.FileName);"]],
    ["app/upload.py", ["# f.save(os.path.join(UPLOAD_DIR, f.filename))"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUploadFilenameSkipsTestsAndDocs(): void {
  const lines = ["f = request.files['avatar']", "f.save(f.filename)"];

  assert.deepEqual(findings([added("tests/test_upload.py", lines), added("fixtures/upload.py", lines), added("docs/upload.md", lines)]), []);
}

export function testUploadFilenameCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { uploadFilename: { enabled: false } } });

  assert.deepEqual(findings([added("src/upload.ts", ["fs.writeFileSync(path.join(dir, req.file.originalname), buf);"])], config), []);
}
