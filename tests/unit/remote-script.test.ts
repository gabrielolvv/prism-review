import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testRemoteScriptRuleReportsDownloadedScriptsThatRun(): void {
  const findings = remoteFindings([
    file("Dockerfile", [
      "FROM node:22-slim",
      "RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
      "RUN wget -qO- https://get.example.dev/install.sh | sudo -E sh",
      "RUN curl -sSL http://insecure.example/bootstrap.py | python3"
    ]),
    file(".github/workflows/ci.yml", [
      "      - run: bash <(curl -s https://codecov.io/bash)",
      '      - run: sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"',
      '      - run: eval "$(curl -fsSL https://tools.example.dev/env)"'
    ]),
    file("scripts/setup.ps1", [
      "iex (iwr https://chocolatey.org/install.ps1 -UseBasicParsing)",
      "Invoke-RestMethod https://get.scoop.sh | Invoke-Expression",
      "(New-Object Net.WebClient).DownloadString('https://tools.example.dev/a.ps1') | iex"
    ]),
    file("Makefile", ["install:", "\tcurl -fsSL $(INSTALLER_URL) | sh"]),
    file("tools/bootstrap.sh", ["curl -sSL https://install.python-poetry.org | python3 -", "curl -s https://x.example/s.pl | perl"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]).sort(),
    [
      [".github/workflows/ci.yml", 1, "warning"],
      ["Dockerfile", 2, "high"],
      ["Makefile", 2, "warning"],
      ["tools/bootstrap.sh", 1, "warning"],
      ["scripts/setup.ps1", 1, "warning"]
    ].sort()
  );
  const message = (path: string) => findings.find((finding) => finding.file === path)?.message;
  assert.equal(
    message("Dockerfile"),
    "Lines 2, 3, 4 run scripts downloaded from deb.nodesource.com, get.example.dev, insecure.example without checking them, and line 4 downloads over plain HTTP."
  );
  assert.equal(
    message(".github/workflows/ci.yml"),
    "Lines 1, 2, 3 run scripts downloaded from codecov.io, raw.githubusercontent.com, tools.example.dev without checking them."
  );
  assert.equal(message("Makefile"), "Line 2 runs a script downloaded from a URL in a variable without checking it.");
}

export function testRemoteScriptRuleIgnoresDownloadsThatDoNotRun(): void {
  const findings = remoteFindings([
    file("Dockerfile", [
      "RUN curl -fsSLo /tmp/install.sh https://get.example.dev/install.sh \\",
      '  && echo "$INSTALL_SHA256  /tmp/install.sh" | sha256sum -c - \\',
      "  && sh /tmp/install.sh",
      "RUN curl -fsSL https://api.example.com/data.json | jq .version",
      "RUN wget -qO- https://example.com/archive.tar.gz | tar xz",
      // These interpreters read the download as data: `-m`, `-c`, and `-e` give them other code to run.
      "RUN curl -s https://api.example.com/x | python3 -m json.tool",
      'RUN curl -s https://api.example.com/x | python -c "import sys, json; print(json.load(sys.stdin))"',
      'RUN curl -s https://api.example.com/x | node -e "process.stdin.pipe(process.stdout)"',
      "# RUN curl https://get.example.dev | sh",
      "RUN echo 'curl https://get.example.dev | sh' > notes.txt"
    ]),
    // Installation guides show these commands on purpose.
    file("README.md", ["curl -fsSL https://get.example.dev | sh"]),
    file("docs/install.rst", ["curl -fsSL https://get.example.dev | sh"]),
    file("tests/unit/installer.test.ts", ['const command = "curl -fsSL https://get.example.dev | sh";'])
  ]);

  assert.deepEqual(findings, []);
}

export function testRemoteScriptRuleJoinsContinuedLines(): void {
  const patch = [
    "@@ -1,6 +1,9 @@",
    " RUN apt-get update \\",
    "+  && curl -fsSL https://deb.example.dev/setup.sh \\",
    "+    | bash - \\",
    "   && apt-get install -y nodejs",
    " RUN curl -fsSL https://get.example.dev/install.sh \\",
    "+  | sh",
    " RUN curl -fsSL https://old.example.dev/install.sh \\",
    "   | sh",
    "+RUN echo done"
  ].join("\n");

  const findings = remoteFindings([{ path: "Dockerfile", status: "modified", additions: 4, deletions: 0, patch }]);

  // Each command is reported on its first added line; one that this patch leaves alone is not.
  assert.equal(findings.length, 1);

  // A comment never continues onto the next line, and Docker skips comments inside a continued RUN.
  const commented = remoteFindings([
    file("Dockerfile", [
      "# Install the CLI \\",
      "RUN curl -fsSL https://get.example.dev/install.sh | sh",
      "RUN wget -qO- https://tools.example.dev/setup.sh \\",
      "  # pipe it straight into the shell",
      "  | sudo -E env DEBIAN_FRONTEND=noninteractive bash"
    ])
  ]);
  assert.equal(
    commented[0]?.message,
    "Lines 2, 3 run scripts downloaded from get.example.dev, tools.example.dev without checking them."
  );
  assert.equal(
    findings[0]?.message,
    "Lines 2, 6 run scripts downloaded from deb.example.dev, get.example.dev without checking them."
  );
}

export function testRemoteScriptRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { remoteScripts: { enabled: false } } });
  const files = [file("install.sh", ["curl -fsSL https://get.example.dev | sh"])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "remote-script"));
}

function remoteFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "remote-script");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
