import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// Settings that accept whatever host key an SSH server presents, as OpenSSH options in scripts,
// CI workflows, Dockerfiles, and ssh_config, and as calls in each language's SSH library.
const settings: Array<{ files: RegExp; pattern: RegExp; call?: boolean }> = [
  // OpenSSH options in scripts, CI workflows, Dockerfiles, and ssh_config: `-o StrictHostKeyChecking=no`
  // and `UserKnownHostsFile=/dev/null`, which forgets every key it is shown.
  {
    files: /^(?!.*\.(?:py|rb|go|java|kt|groovy|scala|[cm]?[jt]sx?|cs|php)$)/i,
    pattern: /\bStrictHostKeyChecking\s*[=\s]\s*["']?(?:no|off)\b|\bUserKnownHostsFile\s*[=\s]\s*["']?\/dev\/null\b/i
  },
  // In code, only as an argument: after `-o`, as a string that starts with the option, as in
  // Ansible's `b"StrictHostKeyChecking=no"`, or as a keyword argument. Prose that names the option,
  // such as a description, is not a connection.
  {
    files: /\.(?:py|rb|go|java|kt|groovy|scala|[cm]?[jt]sx?|cs|php)$/i,
    pattern: /(?:-o\s*["']?|(?:^|[^\w])b?["'`])(?:StrictHostKeyChecking\s*[=\s]\s*(?:no|off)|UserKnownHostsFile\s*[=\s]\s*\/dev\/null)\b|\b(?:StrictHostKeyChecking\s*=\s*["'](?:no|off)["']|UserKnownHostsFile\s*=\s*["']\/dev\/null["'])/i
  },
  // Ansible's host key checking turned off.
  { files: /(?:^|\/)ansible\.cfg$|\.(?:ini|cfg|ya?ml|sh|env)$|(?:^|\/)Dockerfile[^/]*$/i, pattern: /\b(?:ANSIBLE_)?HOST_KEY_CHECKING\s*[=:]\s*["']?(?:False|false|no|0)\b/i },
  // Paramiko's policies that add or only warn about unknown keys, and asyncssh without known hosts.
  {
    files: /\.py$/i,
    call: true,
    pattern: /(?<![\w.])(?:paramiko\.)?(?:AutoAddPolicy|WarningPolicy)\s*\(\s*\)|\basyncssh\.(?:connect|create_connection|connect_reverse|SSHClientConnectionOptions)\s*\([^)]*\bknown_hosts\s*=\s*None\b/
  },
  // Go's x/crypto/ssh: the insecure callback, or one that accepts every key.
  { files: /\.go$/i, call: true, pattern: /\bssh\.InsecureIgnoreHostKey\s*\(\s*\)|\bHostKeyCallback\s*:\s*func\s*\([^)]*\)\s*error\s*\{\s*return\s+nil\s*\}/ },
  // JSch, sshj, and Apache MINA SSHD.
  {
    files: /\.(?:java|kt|groovy|scala)$/i,
    call: true,
    pattern: /["']StrictHostKeyChecking["']\s*,\s*["']no["']|\bnew\s+PromiscuousVerifier\s*\(\s*\)|\bAcceptAllServerKeyVerifier\.INSTANCE\b|\bnew\s+AcceptAllServerKeyVerifier\s*\(/
  },
  // ssh2 for Node.js with a verifier that accepts every key.
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    call: true,
    pattern: /\bhostVerifier\s*:\s*(?:\(\s*[^)]*\)|\w+)\s*=>\s*(?:true\b|\{\s*return\s+true\s*;?\s*\})|\bhostVerifier\s*:\s*function\s*\([^)]*\)\s*\{\s*return\s+true\s*;?\s*\}/
  },
  // net-ssh, as Capistrano and SSHKit use it.
  { files: /\.rb$/i, call: true, pattern: /\bverify_host_key:\s*(?::never|false)\b|\bparanoid:\s*false\b/ },
  // SSH.NET's HostKeyReceived trusting every key.
  { files: /\.cs$/i, call: true, pattern: /\bCanTrust\s*=\s*true\b/ }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
// An import or a definition of the switch, such as Go's `func InsecureIgnoreHostKey()`, is not a use.
const importOrDefinition = /^\s*(?:from\s+[\w.]+\s+import|import)\b|\bfunc\s+InsecureIgnoreHostKey\b|\bclass\s+(?:AutoAddPolicy|WarningPolicy|PromiscuousVerifier)\b/;
// Code that turns checking off behind an option, as Ansible's accept_hostkey and host_key_checking
// settings do, leaves the choice to whoever sets the option.
const codeFile = /\.(?:py|rb|go|java|kt|groovy|scala|[cm]?[jt]sx?|cs|php)$/i;
const guard = /\bif\b|\bunless\b|\bwhen\b|\belif\b|\belse\b|\s\?\s/;
const guardWindow = 2;
const blockWindow = 30;

const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?|org)$/i;
const maxLineLength = 1_000;

export const sshHostKeyRule: Rule = {
  id: "ssh-host-key",
  description: "Flags SSH connections that accept any host key, such as StrictHostKeyChecking=no, Paramiko's AutoAddPolicy, and Go's InsecureIgnoreHostKey.",
  run({ files, config }) {
    if (!config.rules.sshHostKey.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test setups, such as ansible_test, connect to throwaway hosts.
        developmentPath.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const python = /\.py$/i.test(file.path);
      const code = codeFile.test(file.path);
      const lines = patchLines(file.patch);
      const found: number[] = [];
      // Python docstrings document these options, as Ansible's module documentation does.
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|\'\'\'/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content) || importOrDefinition.test(content)) {
          return;
        }
        const matches = fileSettings.some(({ pattern, call }) => {
          const match = pattern.exec(content);
          // A library call inside a string, such as a deprecation warning that names the option, is
          // not a call. OpenSSH options are written as strings, so they still count.
          return match !== null && !(call === true && insideString(content, match.index));
        });
        if (!matches) {
          return;
        }
        if (
          code &&
          (lines.slice(Math.max(0, index - guardWindow), index + 1).some(({ content: before }) => guard.test(before)) || guard.test(enclosingBlock(lines, index)))
        ) {
          return;
        }
        found.push(line);
      });
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found);
      return [
        {
          ruleId: "ssh-host-key",
          title: "SSH host key not checked",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${text} ${plural ? "connect" : "connects"} over SSH without checking the server's host key, so anyone who can intercept the connection, on the network or by spoofing DNS, can pose as the server and read or change what is sent, including passwords, keys, and deployed code.`,
          recommendation:
            "Pin the server's key: add it to known_hosts ahead of time, such as with `ssh-keyscan` checked against a fingerprint you trust, or a `known_hosts` secret in CI, and keep `StrictHostKeyChecking yes`. In code, load known hosts with Paramiko's `RejectPolicy` and `load_host_keys`, Go's `knownhosts.New`, or the library's equivalent."
        }
      ];
    });
  }
};

// Whether the text before `index` leaves a quote open.
function insideString(content: string, index: number): boolean {
  const before = content.slice(0, index).replace(/\\./g, "");
  return ["'", '"', "`"].some((quote) => (before.split(quote).length - 1) % 2 === 1);
}

// The nearest line before that is indented less, which opens the block this line is in.
function enclosingBlock(lines: Array<{ content: string }>, index: number): string {
  const indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - blockWindow); before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      return content;
    }
  }
  return "";
}
