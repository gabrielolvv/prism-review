import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unconfinedContainerRule } from "../../src/rules/unconfined-container.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unconfinedContainerRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUnconfinedContainerReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("docker-compose.yml", ["services:", "  agent:", "    image: agent:1.0", "    security_opt:", "      - seccomp:unconfined", "      - apparmor:unconfined"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Container sandbox turned off");
  assert.deepEqual(finding?.lines, [5, 6]);
  assert.equal(
    finding?.message,
    "Lines 5, 6 turn off the container's seccomp and AppArmor sandbox, so a process that takes over the container can reach kernel interfaces the sandbox blocks, which is how most container escapes reach the host."
  );
}

export function testUnconfinedContainerReadsEachSetting(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/daemonset.yaml", ["      securityContext:", "        seccompProfile:", "          type: Unconfined"]],
    ["deploy/daemonset.yaml", ["        appArmorProfile:", "          type: Unconfined"]],
    ["charts/agent/templates/daemonset.yaml", ["      annotations:", "        container.apparmor.security.beta.kubernetes.io/agent: \"unconfined\""]],
    ["deploy/pod.yaml", ["  annotations:", "    seccomp.security.alpha.kubernetes.io/pod: unconfined"]],
    ["deploy/pod.yaml", ["        seLinuxOptions:", "          type: spc_t"]],
    ["scripts/run.sh", ["docker run -d --security-opt seccomp=unconfined --name agent agent:1.0"]],
    ["scripts/run.sh", ["podman run --security-opt label=disable -v /data:/data app"]],
    ["Makefile", ["\tdocker run --security-opt=systempaths=unconfined app"]],
    ["infra/containers.tf", ["resource \"docker_container\" \"agent\" {", "  security_opts = [\"apparmor=unconfined\"]", "}"]],
    ["infra/pod.tf", ["      security_context {", "        seccomp_profile {", "          type = \"Unconfined\"", "        }"]],
    ["deploy/task.json", ["\"runArgs\": [", "  \"--security-opt\",", "  \"seccomp=unconfined\"", "]"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnconfinedContainerSkipsConfinedContainers(): void {
  const cases: Array<[string, string[]]> = [
    // Default and custom profiles.
    ["deploy/daemonset.yaml", ["        seccompProfile:", "          type: RuntimeDefault"]],
    ["deploy/daemonset.yaml", ["        seccompProfile:", "          type: Localhost", "          localhostProfile: profiles/agent.json"]],
    ["docker-compose.yml", ["    security_opt:", "      - no-new-privileges:true", "      - seccomp:./seccomp.json"]],
    // `type: Unconfined` under other keys, and the words outside a security option.
    ["deploy/service.yaml", ["spec:", "  type: Unconfined"]],
    ["scripts/selinux.sh", ["chcon -R unconfined_u:object_r:svirt_sandbox_file_t:s0 /data"]],
    ["deploy/config.yaml", ["mode: seccomp=unconfined"]],
    // Schemas that list the allowed values.
    ["schema/container.json", ["\"security_opt\": {", "  \"examples\": [\"seccomp=unconfined\", \"label=disable\"]", "}"]],
    // CI, dev containers, development setups, comments, and documentation.
    [".github/workflows/e2e.yml", ["        options: --security-opt seccomp=unconfined"]],
    [".devcontainer/devcontainer.json", ["\"runArgs\": [\"--cap-add=SYS_PTRACE\", \"--security-opt\", \"seccomp=unconfined\"]"]],
    ["docker-compose.override.yml", ["    security_opt:", "      - seccomp:unconfined"]],
    ["examples/agent/docker-compose.yml", ["    security_opt:", "      - seccomp:unconfined"]],
    ["deploy/daemonset.yaml", ["        # seccompProfile:", "        #   type: Unconfined"]],
    ["docs/agent.md", ["docker run --security-opt seccomp=unconfined agent"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnconfinedContainerSkipsTestsAndCanBeDisabled(): void {
  const lines = ["docker run --security-opt seccomp=unconfined agent"];
  assert.deepEqual(findings([added("test/e2e/run.sh", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { unconfinedContainer: { enabled: false } } });
  assert.deepEqual(findings([added("scripts/run.sh", lines)], config), []);
}
