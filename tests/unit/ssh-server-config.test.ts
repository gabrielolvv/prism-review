import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { sshServerConfigRule } from "../../src/rules/ssh-server-config.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return sshServerConfigRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSshServerConfigReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("roles/ssh/templates/sshd_config.j2", ["Port 22", "PermitRootLogin yes", "PasswordAuthentication yes", "PermitEmptyPasswords no"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "SSH server accepts passwords");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 let the SSH server accept root logins with a password and password logins, so anyone who can reach its port can guess passwords, and bots try common ones on every SSH server they find."
  );
}

export function testSshServerConfigReportsEmptyPasswordsAsHigh(): void {
  const [finding] = findings([added("etc/ssh/sshd_config", ["PermitEmptyPasswords yes"])]);

  assert.equal(finding?.severity, "high");
  assert.equal(
    finding?.message,
    "Line 1 lets the SSH server accept logins with an empty password, so anyone who can reach its port can guess passwords, and bots try common ones on every SSH server they find."
  );
}

export function testSshServerConfigReadsEachWriter(): void {
  const cases: Array<[string, string[]]> = [
    ["etc/ssh/sshd_config.d/50-cloud.conf", ["PasswordAuthentication yes"]],
    ["Dockerfile", ["RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config"]],
    ["Dockerfile", ["RUN echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config"]],
    ["cloud-init/user-data.yaml", ["bootcmd:", "  - if grep -q '^PermitRootLogin' /etc/ssh/sshd_config; then sed -i 's/^PermitRootLogin.*/\\1/' /etc/ssh/sshd_config; else echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config; fi"]],
    ["scripts/provision.sh", ["grep -q '^PermitRootLogin' /etc/ssh/sshd_config || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config"]],
    ["scripts/provision.sh", ["echo 'PasswordAuthentication yes' | sudo tee /etc/ssh/sshd_config.d/01-password.conf"]],
    ["docker/entrypoint.sh", ["exec /usr/sbin/sshd -D -o PasswordAuthentication=yes"]],
    ["roles/ssh/tasks/main.yml", ["- lineinfile:", "    path: /etc/ssh/sshd_config", "    regexp: '^#?PermitRootLogin'", "    line: 'PermitRootLogin yes'"]],
    ["k8s/sshd-configmap.yaml", ["data:", "  sshd_config: |", "    PermitRootLogin yes"]],
    ["cloud-init/user-data.yaml", ["#cloud-config", "ssh_pwauth: true"]],
    ["cloud-init/user-data.yaml", ["#cloud-config", "disable_root: false"]],
    ["infra/vm.tf", ["resource \"azurerm_linux_virtual_machine\" \"app\" {", "  disable_password_authentication = false", "}"]],
    ["infra/vm.json", ["\"linuxConfiguration\": {", "  \"disablePasswordAuthentication\": false", "}"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSshServerConfigSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Turned off, or root logins with keys only.
    ["etc/ssh/sshd_config", ["PermitRootLogin prohibit-password", "PasswordAuthentication no", "PermitEmptyPasswords no"]],
    ["Dockerfile", ["RUN sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config"]],
    ["infra/vm.tf", ["  disable_password_authentication = true"]],
    ["cloud-init/user-data.yaml", ["ssh_pwauth: false"]],
    // Inside a Match block.
    ["etc/ssh/sshd_config", ["PasswordAuthentication no", "Match Address 10.0.0.0/8", "    PasswordAuthentication yes"]],
    // Searches, checks, and the ssh client's own option.
    ["scripts/audit.sh", ["if grep -q '^PermitRootLogin yes' /etc/ssh/sshd_config; then"]],
    ["roles/ssh/tasks/main.yml", ["    regexp: '^PermitRootLogin yes'", "    line: 'PermitRootLogin no'"]],
    ["scripts/deploy.sh", ["ssh -o PasswordAuthentication=yes -o ConnectTimeout=5 deploy@host"]],
    ["scripts/deploy.sh", ["echo \"PermitRootLogin yes is not allowed\""]],
    // Throwaway machines, examples, comments, and documentation.
    ["Vagrantfile", ["  config.vm.provision 'shell', inline: \"echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config\""]],
    ["molecule/default/Dockerfile.j2", ["RUN echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config"]],
    ["examples/linux-vm/main.tf", ["  disable_password_authentication = false"]],
    ["etc/ssh/sshd_config", ["#PermitRootLogin yes"]],
    ["docs/ssh.md", ["PermitRootLogin yes"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSshServerConfigSkipsTestsAndCanBeDisabled(): void {
  const lines = ["PermitRootLogin yes"];
  assert.deepEqual(findings([added("test/fixtures/sshd_config", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { sshServerConfig: { enabled: false } } });
  assert.deepEqual(findings([added("etc/ssh/sshd_config", lines)], config), []);
}
