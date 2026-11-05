import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { insecurePackageSourceRule } from "../../src/rules/insecure-package-source.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return insecurePackageSourceRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testInsecurePackageSourceReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("Dockerfile", [
      "FROM debian:12",
      "RUN echo 'deb [trusted=yes] http://mirror.acme.io/debian bookworm main' > /etc/apt/sources.list.d/acme.list",
      "RUN apt-get update && apt-get install -y --allow-unauthenticated acme-agent",
      "RUN pip install --trusted-host pypi.acme.io --index-url http://pypi.acme.io/simple acme-tools"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Packages from an unchecked source");
  assert.deepEqual(finding?.lines, [2, 3, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 3, 4 install packages without checking where they come from (apt without signature checks and pip over HTTP or without TLS checks), so anyone on the network path, a hijacked mirror, or a poisoned cache can swap in a package that runs its code in the build and in the app."
  );
}

export function testInsecurePackageSourceReadsEachManager(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["deploy/acme.repo", ["[acme]", "baseurl=https://repo.acme.io/el9", "gpgcheck=0"], "high"],
    ["scripts/install.sh", ["dnf install -y --nogpgcheck acme-agent"], "high"],
    ["roles/agent/tasks/main.yml", ["- ansible.builtin.dnf:", "    name: acme-agent", "    disable_gpg_check: true"], "high"],
    ["Dockerfile", ["RUN apk add --allow-untrusted /tmp/acme.apk"], "high"],
    ["Dockerfile", ["ENV GOSUMDB=off GOFLAGS=-mod=mod"], "high"],
    ["Dockerfile", ["ENV GOINSECURE=git.acme.io"], "warning"],
    ["requirements.txt", ["--index-url http://pypi.acme.io/simple", "requests==2.32.3"], "warning"],
    ["pip.conf", ["[global]", "trusted-host = pypi.acme.io"], "warning"],
    ["Pipfile", ["[[source]]", "url = \"http://pypi.acme.io/simple\"", "verify_ssl = false"], "warning"],
    [".npmrc", ["registry=http://npm.acme.io/"], "warning"],
    [".yarnrc.yml", ["npmRegistryServer: \"http://npm.acme.io\""], "warning"],
    ["pom.xml", ["  <repositories>", "    <repository>", "      <id>acme</id>", "      <url>http://maven.acme.io/releases</url>"], "warning"],
    ["build.gradle.kts", ["    maven {", "        url = uri(\"http://maven.acme.io\")", "        isAllowInsecureProtocol = true", "    }"], "warning"],
    ["deploy/daemon.json", ["{ \"insecure-registries\": [\"registry.acme.io:5000\"] }"], "warning"],
    ["NuGet.config", ["    <add key=\"acme\" value=\"http://nuget.acme.io/v3/index.json\" />"], "warning"],
    ["composer.json", ["    \"secure-http\": false"], "warning"],
    ["Gemfile", ["source \"http://gems.acme.io\""], "warning"],
    [".condarc", ["ssl_verify: false"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testInsecurePackageSourceSkipsCheckedSourcesAndOtherCommands(): void {
  const cases: Array<[string, string[]]> = [
    // HTTPS with checks on, and signature checks on.
    ["deploy/acme.repo", ["gpgcheck=1", "baseurl=https://repo.acme.io/el9"]],
    [".npmrc", ["registry=https://npm.acme.io/"]],
    ["requirements.txt", ["--index-url https://pypi.acme.io/simple"]],
    // Local mirrors, such as Verdaccio or a devpi on this machine.
    [".npmrc", ["registry=http://localhost:4873/"]],
    ["requirements.txt", ["--extra-index-url http://127.0.0.1:3141/root/pypi/+simple/"]],
    // Short flags of other commands, and HTTP URLs that are not package sources.
    ["scripts/fetch.sh", ["curl -f http://downloads.acme.io/tool.tar.gz -o tool.tar.gz", "curl -i http://status.acme.io"]],
    ["pyproject.toml", ["[project.urls]", "Homepage = \"http://acme.io\""]],
    ["pom.xml", ["  <organization>", "    <url>http://acme.io</url>", "  </organization>"]],
    // Comments, documentation, and development setups.
    ["Dockerfile", ["# RUN apt-get install --allow-unauthenticated acme"]],
    ["docs/install.md", ["apt-get install --allow-unauthenticated acme"]],
    [".devcontainer/Dockerfile", ["RUN apt-get install -y --allow-unauthenticated acme"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testInsecurePackageSourceSkipsTestsAndCanBeDisabled(): void {
  const lines = ["RUN apt-get install -y --allow-unauthenticated acme"];
  assert.deepEqual(findings([added("tests/fixtures/Dockerfile", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { insecurePackageSource: { enabled: false } } });
  assert.deepEqual(findings([added("Dockerfile", lines)], config), []);
}
