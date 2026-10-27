import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";

export function testPrivilegedContainerRuleReportsHostAccess(): void {
  const findings = containerFindings([
    file("k8s/agent.yaml", [
      "spec:",
      "  hostNetwork: true",
      "  hostPID: true",
      "  containers:",
      "    - name: agent",
      "      securityContext:",
      "        privileged: true",
      "        allowPrivilegeEscalation: true",
      "        runAsUser: 0",
      "        capabilities:",
      "          drop:",
      "            - ALL",
      "          add:",
      "            - SYS_ADMIN",
      "      volumeMounts:",
      "        - name: docker",
      "          mountPath: /var/run/docker.sock",
      "  volumes:",
      "    - name: docker",
      "      hostPath:",
      "        path: /var/run/docker.sock"
    ]),
    file("docker-compose.yml", [
      "services:",
      "  ci:",
      "    image: ci-runner:1.4",
      "    network_mode: host",
      "    cap_add: [NET_BIND_SERVICE, SYS_ADMIN]",
      "    volumes:",
      "      - /var/run/docker.sock:/var/run/docker.sock"
    ]),
    file("scripts/run.sh", ["docker run --rm --privileged --pid=host -v /var/run/docker.sock:/var/run/docker.sock tool:1"]),
    file("deploy/values.yaml", ["securityContext:", "  runAsNonRoot: false"])
  ]);

  assert.deepEqual(
    findings.map((finding) => [finding.file, finding.line, finding.severity]).sort(),
    [
      ["deploy/values.yaml", 2, "warning"],
      ["docker-compose.yml", 4, "high"],
      ["k8s/agent.yaml", 2, "high"],
      ["scripts/run.sh", 1, "high"]
    ].sort()
  );
  const message = (path: string) => findings.find((finding) => finding.file === path)?.message;
  assert.equal(
    message("k8s/agent.yaml"),
    "Lines 2, 3, 7, 8, 9 and 2 more weaken a container's isolation from its host: runs a privileged container, adds the SYS_ADMIN or ALL capability, mounts the Docker socket, shares the host's network, process, or IPC namespace, allows privilege escalation, and runs as root."
  );
  assert.equal(
    message("scripts/run.sh"),
    "Line 1 weakens a container's isolation from its host: runs a privileged container, mounts the Docker socket, and shares the host's network, process, or IPC namespace."
  );
  assert.equal(message("deploy/values.yaml"), "Line 2 weakens a container's isolation from its host: runs as root.");
}

export function testPrivilegedContainerRuleIgnoresHardenedAndUnrelatedSettings(): void {
  const findings = containerFindings([
    file("k8s/app.yaml", [
      "      securityContext:",
      "        privileged: false",
      "        allowPrivilegeEscalation: false",
      "        runAsNonRoot: true",
      "        runAsUser: 1000",
      "        capabilities:",
      "          drop: [\"ALL\"]",
      "          add:",
      "            - NET_BIND_SERVICE",
      "  hostNetwork: false",
      "  # privileged: true while debugging"
    ]),
    file(".gitlab-ci.yml", ["  variables:", "    DOCKER_HOST: unix:///var/run/docker.sock"]),
    file("docker-compose.yml", ["    cap_drop:", "      - ALL", "    network_mode: bridge"]),
    file("docs/debugging.md", ["Run `docker run --privileged` to debug."]),
    file("tests/fixtures/pod.yaml", ["        privileged: true"])
  ]);

  assert.deepEqual(findings, []);
}

export function testPrivilegedContainerRuleCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { privilegedContainers: { enabled: false } } });
  const files = [file("k8s/pod.yaml", ["        privileged: true"])];

  assert.ok(!analyzePullRequest(files, config).findings.some((finding) => finding.ruleId === "privileged-container"));
}

function containerFindings(files: ChangedFile[]) {
  return analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "privileged-container");
}

function file(path: string, lines: string[]): ChangedFile {
  const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
  return { path, status: "added", additions: lines.length, deletions: 0, patch };
}
