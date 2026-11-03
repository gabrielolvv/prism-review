import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { sshHostKeyRule } from "../../src/rules/ssh-host-key.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return sshHostKeyRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSshHostKeyReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added(".github/workflows/deploy.yml", [
      "      - name: Deploy",
      "        run: |",
      "          ssh -o StrictHostKeyChecking=no deploy@${{ secrets.HOST }} './deploy.sh'",
      "          scp -o UserKnownHostsFile=/dev/null build.tar deploy@${{ secrets.HOST }}:/srv"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "SSH host key not checked");
  assert.deepEqual(finding?.lines, [3, 4]);
  assert.equal(
    finding?.message,
    "Lines 3, 4 connect over SSH without checking the server's host key, so anyone who can intercept the connection, on the network or by spoofing DNS, can pose as the server and read or change what is sent, including passwords, keys, and deployed code."
  );
}

export function testSshHostKeyReadsEachTool(): void {
  const cases: Array<[string, string[]]> = [
    ["scripts/deploy.sh", ["rsync -e 'ssh -o StrictHostKeyChecking=no' dist/ deploy@host:/srv"]],
    ["deploy/ssh_config", ["Host *", "  StrictHostKeyChecking no"]],
    ["ansible.cfg", ["[defaults]", "host_key_checking = False"]],
    ["Dockerfile", ["ENV ANSIBLE_HOST_KEY_CHECKING=False"]],
    ["deploy/remote.py", ["client = paramiko.SSHClient()", "client.set_missing_host_key_policy(paramiko.AutoAddPolicy())"]],
    ["deploy/remote.py", ["conn = await asyncssh.connect(host, username=user, known_hosts=None)"]],
    ["deploy/remote.go", ["config := &ssh.ClientConfig{User: user, Auth: auth, HostKeyCallback: ssh.InsecureIgnoreHostKey()}"]],
    ["deploy/remote.go", ["\tHostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error { return nil },"]],
    ["src/main/java/app/Sftp.java", ["session.setConfig(\"StrictHostKeyChecking\", \"no\");"]],
    ["src/main/java/app/Sftp.java", ["ssh.addHostKeyVerifier(new PromiscuousVerifier());"]],
    ["src/deploy.js", ["conn.connect({ host, username, privateKey, hostVerifier: () => true });"]],
    ["config/deploy.rb", ["set :ssh_options, verify_host_key: :never"]],
    ["Deploy/Remote.cs", ["client.HostKeyReceived += (sender, e) => e.CanTrust = true;"]],
    // OpenSSH options passed from code, as an argument string or a keyword argument.
    ["lib/tasks/git.rake", ["exec ssh -o PasswordAuthentication=no -o StrictHostKeyChecking=no \"$@\""]],
    ["plugins/connection/ssh.py", ["args = (b\"-o\", b\"StrictHostKeyChecking=no\")"]],
    ["tools/ssh.py", ["options = dict(StrictHostKeyChecking='no', ServerAliveInterval=15)"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSshHostKeySkipsCheckedConnections(): void {
  const cases: Array<[string, string[]]> = [
    ["scripts/deploy.sh", ["ssh-keyscan -H \"$HOST\" >> ~/.ssh/known_hosts", "ssh -o StrictHostKeyChecking=yes deploy@\"$HOST\" './deploy.sh'"]],
    ["deploy/remote.py", ["client.load_system_host_keys()", "client.set_missing_host_key_policy(paramiko.RejectPolicy())"]],
    ["deploy/remote.go", ["callback, err := knownhosts.New(path.Join(home, \".ssh\", \"known_hosts\"))", "config := &ssh.ClientConfig{HostKeyCallback: callback}"]],
    // Behind an option, as Ansible's accept_hostkey is, and inside a string such as a warning.
    ["lib/modules/git.py", ["    if module.params['accept_hostkey']:", "        ssh_opts += \" -o StrictHostKeyChecking=no\""]],
    ["lib/net/ssh/session.rb", ["  Kernel.warn('verify_host_key: false is deprecated, use :never')"]],
    // A library defining the switch, an import, a docstring, and development setups.
    ["ssh/client.go", ["func InsecureIgnoreHostKey() HostKeyCallback {"]],
    ["deploy/remote.py", ["from paramiko import AutoAddPolicy, SSHClient"]],
    ["modules/git.py", ['    """', "    accept_hostkey: adds -o StrictHostKeyChecking=no to the ssh options.", '    """']],
    ["test/integration/ssh.py", ["client.set_missing_host_key_policy(paramiko.AutoAddPolicy())"]],
    ["scripts/deploy.sh", ["# ssh -o StrictHostKeyChecking=no deploy@host"]],
    // Prose in code that names the option, such as a rule's own description.
    ["src/rules/ssh.ts", ["  description: \"Flags SSH connections that accept any host key, such as StrictHostKeyChecking=no.\","]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSshHostKeySkipsTestsAndCanBeDisabled(): void {
  const line = "ssh -o StrictHostKeyChecking=no deploy@host";
  assert.deepEqual(findings([added("tests/deploy.test.sh", [line]), added("fixtures/deploy.sh", [line]), added("docs/deploy.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { sshHostKey: { enabled: false } } });
  assert.deepEqual(findings([added("scripts/deploy.sh", [line])], config), []);
}
