import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { hostPathMountRule } from "../../src/rules/host-path-mount.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return hostPathMountRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testHostPathMountReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("k8s/agent.yaml", [
      "      volumes:",
      "        - name: host",
      "          hostPath:",
      "            path: /",
      "        - name: runtime",
      "          hostPath:",
      "            path: /run/containerd/containerd.sock",
      "        - name: data",
      "          hostPath:",
      "            path: /var/lib/agent"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Sensitive host path mounted");
  assert.deepEqual(finding?.lines, [4, 7]);
  assert.equal(
    finding?.message,
    "Lines 4, 7 mount `/` and `/run/containerd/containerd.sock` from the host into a container, so anyone who takes over the container can read the host's secrets and, where the mount is writable, change the host or start containers of their own, which gives them the host and every container on it."
  );
}

export function testHostPathMountReadsEachFormat(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["k8s/daemonset.yaml", ["        - name: etc", "          hostPath: { path: /etc, type: Directory }"], "high"],
    ["deploy/docker-compose.yml", ["    volumes:", "      - /:/rootfs"], "high"],
    ["deploy/docker-compose.yml", ["    volumes:", "      - /proc:/host/proc:ro", "      - /sys:/host/sys:ro"], "warning"],
    ["deploy/docker-compose.yml", ["    volumes:", "      - ~/.aws:/root/.aws"], "high"],
    ["deploy/docker-compose.yml", ["    volumes:", "      - type: bind", "        source: /var/lib/kubelet", "        target: /kubelet"], "high"],
    ["scripts/run.sh", ["docker run -d -v /etc:/host/etc acme/agent"], "high"],
    ["scripts/run.sh", ["docker run --mount type=bind,source=/,target=/host,readonly acme/agent"], "warning"],
    ["infra/agent.tf", ["        host_path {", "          path = \"/var/lib/docker\"", "        }"], "high"],
    [
      "k8s/scanner.yaml",
      [
        "          volumeMounts:",
        "            - name: etc-kubernetes",
        "              mountPath: /etc/kubernetes",
        "              readOnly: true",
        "      volumes:",
        "        - name: etc-kubernetes",
        "          hostPath:",
        "            path: /etc/kubernetes"
      ],
      "warning"
    ]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testHostPathMountSkipsNarrowPathsAndOtherSetups(): void {
  const cases: Array<[string, string[]]> = [
    // Narrow data and log folders, named volumes, and the Docker socket, which privileged-container reports.
    ["k8s/agent.yaml", ["          hostPath:", "            path: /var/log/pods", "          hostPath:", "            path: /var/lib/agent/data"]],
    ["deploy/docker-compose.yml", ["    volumes:", "      - data:/var/lib/postgresql/data", "      - ./config:/etc/app", "      - /var/run/docker.sock:/var/run/docker.sock"]],
    // Other `path:` keys, such as an HTTP probe's.
    ["k8s/app.yaml", ["          httpGet:", "            path: /", "            port: 8080"]],
    // CI service containers, development setups, and documentation.
    [".github/workflows/ci.yml", ["        run: docker run -v /:/host acme/scanner"]],
    ["deploy/docker-compose.override.yml", ["    volumes:", "      - ~/.aws:/root/.aws"]],
    ["deploy/docker-compose.dev.yml", ["    volumes:", "      - /:/rootfs"]],
    ["roles/agent/molecule/default/molecule.yml", ["    volumes:", "      - /sys/fs/cgroup:/sys/fs/cgroup:rw"]],
    ["k8s/logs.yaml", ["          hostPath:", "            path: /var/lib/docker/containers"]],
    ["docs/agent.md", ["docker run -v /:/host acme/agent"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testHostPathMountSkipsTestsAndCanBeDisabled(): void {
  const lines = ["          hostPath:", "            path: /"];
  assert.deepEqual(findings([added("tests/fixtures/agent.yaml", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { hostPathMount: { enabled: false } } });
  assert.deepEqual(findings([added("k8s/agent.yaml", lines)], config), []);
}
