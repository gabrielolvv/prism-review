import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { insecureTempFileRule } from "../../src/rules/insecure-temp-file.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return insecureTempFileRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testInsecureTempFileReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/export.py", [
      "import tempfile",
      "path = tempfile.mktemp(suffix='.csv')",
      "with open('/tmp/report.csv', 'w') as out:",
      "    out.write(data)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Predictable temporary file");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 make temporary file names without creating the files, and write to fixed paths in /tmp, so another user on the machine can create that file, or a symbolic link with its name, first, and read what the program writes or make it overwrite another file."
  );
}

export function testInsecureTempFileReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["app/cache.py", ["from tempfile import gettempdir, mktemp", "name = mktemp()"]],
    ["app/cache.py", ["name = os.tempnam('/var/tmp', 'app')"]],
    ["src/dump.c", ['dump_name = tempnam(NULL, "lxml");']],
    ["src/io.cpp", ["char *name = tmpnam(nullptr);"]],
    ["scripts/build.sh", ['tmp="$(mktemp -u)"']],
    ["scripts/build.sh", ["echo $data > /tmp/build.$$"]],
    ["lib/cache.rb", ["path = Dir::Tmpname.make_tmpname('cache', nil)"]],
    ["lib/cache.rb", ["File.write('/tmp/cache.json', JSON.dump(data))"]],
    ["src/cache.js", ["fs.writeFileSync('/tmp/session.json', JSON.stringify(session));"]],
    ["cache.go", ['f, err := os.Create("/tmp/cache.db")']],
    ["src/Cache.java", ['FileOutputStream out = new FileOutputStream("/tmp/cache.bin");']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testInsecureTempFileSkipsSafeCalls(): void {
  const cases: Array<[string, string[]]> = [
    ["app/export.py", ["fd, path = tempfile.mkstemp(suffix='.csv')", "with tempfile.NamedTemporaryFile('w') as out:", "    pass"]],
    ["app/export.py", ["with open('/tmp/report.csv') as source:", "    data = source.read()"]],
    ["src/dump.c", ["int fd = mkstemp(template);", "errno_t err = tmpnam_s(name, L_tmpnam);"]],
    // A declaration, and a variable with a similar name.
    ["include/compat.h", ["extern char *tmpnam(char *s);", "char tmpname[32];"]],
    ["scripts/build.sh", ['tmp="$(mktemp)"', 'dir="$(mktemp -d)"', "echo done > /tmp/build.log"]],
    ["src/upload.php", ["$file = tempnam(sys_get_temp_dir(), 'upload');"]],
    ["src/cache.js", ["const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-'));", "fs.writeFileSync(`/tmp/${id}.json`, body);"]],
    ["cache.go", ['f, err := os.CreateTemp("", "cache-*.db")']],
    // Docstrings and comments.
    ["app/compat.py", ['    """', "    Unlike tempfile.mktemp(), this creates the file.", '    """']],
    ["app/compat.py", ["# path = tempfile.mktemp()"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testInsecureTempFileSkipsTestsAndCanBeDisabled(): void {
  const line = "path = tempfile.mktemp()";
  assert.deepEqual(findings([added("tests/test_export.py", [line]), added("fixtures/export.py", [line]), added("docs/tmp.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { insecureTempFile: { enabled: false } } });
  assert.deepEqual(findings([added("app/export.py", [line])], config), []);
}
