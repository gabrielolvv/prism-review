import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { filePermissionsRule } from "../../src/rules/file-permissions.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return filePermissionsRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Built at runtime, so this test file does not hold the commands it checks for.
const chmod = ["ch", "mod"].join("");

export function testFilePermissionsReportsShellAndDocker(): void {
  const [finding] = findings([
    added("scripts/setup.sh", [
      `${chmod} -R 777 /var/app`,
      `${chmod} o+w,g+w shared.log`,
      `${chmod} 4755 /usr/local/bin/helper`,
      `${chmod} u+s ./runner`,
      "umask 000",
      `find . -type f -exec ${chmod} 0666 {} \;`
    ])
  ]);

  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [1, 2, 3, 4, 5, 6]);
  assert.equal(
    finding?.message,
    "Lines 1, 2, 3, 4, 5 and 1 more change file permissions in a way that makes files writable by every user, sets the setuid bit, so a program runs with its owner's rights, and sets a umask that leaves new files writable by every user."
  );

  const docker = findings([added("Dockerfile", ["COPY --chmod=777 app /app", `RUN ${chmod} a+rwx /data`])]);
  assert.deepEqual(docker[0]?.lines, [1, 2]);
}

export function testFilePermissionsReportsCodeCalls(): void {
  const calls = [
    `os.${chmod}(path, 0o777)`,
    `fs.${chmod}Sync(target, 0o666);`,
    `os.C${chmod.slice(1)}(name, 0777)`,
    "os.umask(0)",
    "process.umask(0o000);"
  ];
  const [finding] = findings([added("src/setup.py", calls)]);
  assert.deepEqual(finding?.lines, [1, 2, 3, 4, 5]);
}

export function testFilePermissionsSkipsSafeModes(): void {
  const safe = [
    `${chmod} +x ./build.sh`,
    `${chmod} 755 /usr/local/bin/tool`,
    `${chmod} 0644 config.yml`,
    `${chmod} 1777 /tmp/shared`,
    `${chmod} 2775 /srv/team`,
    `${chmod} g+s /srv/team`,
    `${chmod} +w notes.txt`,
    `${chmod} go-w file`,
    `${chmod} "$MODE" file`,
    "umask 022",
    "umask 0002",
    `os.${chmod}(path, 0o640)`,
    `# ${chmod} 777 /tmp`,
    `// ${chmod} 777 /tmp`
  ];
  assert.deepEqual(findings([added("scripts/setup.sh", safe)]), []);

  const lines = [`${chmod} 777 /app`];
  assert.deepEqual(findings([added("docs/install.md", lines)]), []);
  assert.deepEqual(findings([added("tests/setup.test.ts", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/setup.sh", lines)]), []);
  assert.deepEqual(findings([added("setup.sh", lines)], prismConfigSchema.parse({ rules: { filePermissions: { enabled: false } } })), []);
}
