import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "empty" | "root" | "password";

const labels: Record<Kind, string> = {
  empty: "logins with an empty password",
  root: "root logins with a password",
  password: "password logins"
};

// The OpenSSH server's own settings, as written to sshd_config.
const directives: Array<{ kind: Kind; pattern: RegExp }> = [
  { kind: "empty", pattern: /\bPermitEmptyPasswords\s*[\s=]\s*["']?yes\b/i },
  { kind: "root", pattern: /\bPermitRootLogin\s*[\s=]\s*["']?yes\b/i },
  { kind: "password", pattern: /\bPasswordAuthentication\s*[\s=]\s*["']?yes\b/i }
];
// Settings of cloud images and VMs that turn on the same logins.
const platformSettings: Array<{ kind: Kind; files: RegExp; pattern: RegExp }> = [
  // cloud-init's user data.
  { kind: "password", files: /\.(?:ya?ml|cfg|tpl|j2|sh|tf|hcl|json)$|(?:^|\/)(?:user-data|cloud-config)[^/]*$/i, pattern: /^\s*["']?ssh_pwauth["']?\s*:\s*["']?(?:true|yes|1)\b/i },
  { kind: "root", files: /\.(?:ya?ml|cfg|tpl|j2|sh|tf|hcl|json)$|(?:^|\/)(?:user-data|cloud-config)[^/]*$/i, pattern: /^\s*["']?disable_root["']?\s*:\s*["']?(?:false|no|0)\b/i },
  // Azure Linux VMs, in Terraform, ARM templates, and Bicep.
  { kind: "password", files: /\.(?:tf|hcl)$/i, pattern: /^\s*disable_password_authentication\s*=\s*false\b/ },
  { kind: "password", files: /\.(?:json|bicep)$/i, pattern: /["']?disablePasswordAuthentication["']?\s*:\s*false\b/ }
];

// sshd_config itself, its drop-ins, and templates of it.
const sshdConfig = /(?:^|\/)sshd_config(?:\.d\/[^/]+|[^/]*)$|(?:^|\/)sshd[^/]*\.(?:conf|j2|tpl|erb)$/i;
// Files that write sshd_config: Dockerfiles, scripts, Ansible, cloud-init, ConfigMaps, and Packer.
const writerFile = /\.(?:sh|bash|zsh|ya?ml|j2|tpl|tf|hcl|json|cfg|conf|ps1|mk)$|(?:^|\/)(?:Dockerfile[^/]*|[^/]*\.dockerfile|Makefile|Containerfile|user-data)$/i;
// A line that writes the directive into the file, or is the file's own line, as in a heredoc or a
// ConfigMap. A line that only searches for it, such as `grep` or Ansible's `regexp:`, is not.
const writes = /\bsshd_config\b|>>|\btee\b|^\s*-?\s*["']?(?:line|value|content|text)["']?\s*:/;
const wholeLine = /^\s*-?\s*["']?(?:PermitEmptyPasswords|PermitRootLogin|PasswordAuthentication)\s+["']?yes["']?\s*(?:#.*)?$/i;
const searches = /\bgrep\b|\bregexp\s*:|\bassert\b|\bsearch_string\b|\bshould\b|\bexpect\b/i;
// `sed 's/old/new/'`: only the replacement part is written.
const sedSubstitution = /\bsed\b[^|;&\n]*?\bs([/|#,@])((?:\\.|(?!\1).)*)\1((?:\\.|(?!\1).)*)\1/;
// `sshd -o PasswordAuthentication=yes`, but not the same option given to the ssh client.
const sshdOption = /\bsshd\b[^|;&\n]*-o\s*["']?(?:PermitEmptyPasswords|PermitRootLogin|PasswordAuthentication)=yes\b/i;
// sshd_config's Match blocks, which limit settings to some users or addresses.
const matchBlock = /^\s*Match\s+\S/i;

// Vagrant boxes, CI, and Molecule and Test Kitchen setups are throwaway machines.
const throwaway =
  /(?:^|\/)(?:Vagrantfile|\.kitchen[^/]*\.ya?ml|kitchen\.ya?ml)$|(?:^|\/)(?:molecule|\.github\/workflows|\.gitlab-ci[^/]*|\.circleci|\.buildkite|\.devcontainer|azure-pipelines[^/]*|bitbucket-pipelines[^/]*)(?:\/|$)/i;
const commentLine = /^\s*(?:#|\/\/|;|<!--|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const sshServerConfigRule: Rule = {
  id: "ssh-server-config",
  description: "Flags SSH servers set to accept password logins, root logins with a password, or empty passwords.",
  run({ files, config }) {
    if (!config.rules.sshServerConfig.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const ownConfig = sshdConfig.test(file.path);
      const writer = writerFile.test(file.path);
      const fileSettings = platformSettings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (!ownConfig && !writer && fileSettings.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        throwaway.test(file.path) ||
        // Development, example, and test machines.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; kind: Kind }> = [];
      let inMatchBlock = false;
      for (const { line, content, added, startsHunk } of lines) {
        if (startsHunk) {
          inMatchBlock = false;
        }
        if (ownConfig && matchBlock.test(content)) {
          inMatchBlock = true;
        }
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        const kind = ownConfig ? (inMatchBlock ? undefined : directiveIn(content)) : writer ? writtenDirective(content) : undefined;
        const setting = kind ?? fileSettings.find(({ pattern }) => pattern.test(content))?.kind;
        if (setting !== undefined) {
          found.push({ line, kind: setting });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      return [
        {
          ruleId: "ssh-server-config",
          title: "SSH server accepts passwords",
          severity: kinds.includes("empty") ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} the SSH server accept ${listOf(kinds.map((kind) => labels[kind]))}, so anyone who can reach its port can guess passwords, and bots try common ones on every SSH server they find.`,
          recommendation:
            "Use key-based logins only: set `PasswordAuthentication no`, `PermitEmptyPasswords no`, and `PermitRootLogin prohibit-password` or `no`, keep cloud-init's `ssh_pwauth: false` and Azure's `disable_password_authentication = true`, and reach machines through a bastion or a VPN. When passwords must stay on, limit them with a `Match Address` block for internal networks and add rate limits such as fail2ban."
        }
      ];
    });
  }
};

function directiveIn(content: string): Kind | undefined {
  return directives.find(({ pattern }) => pattern.test(content))?.kind;
}

// The directive a line of a Dockerfile, script, or YAML file writes to sshd_config.
function writtenDirective(content: string): Kind | undefined {
  // A search, unless the same line also appends to the file, as in `grep -q ... || echo ... >> sshd_config`.
  if (searches.test(content) && !/>>|\btee\b/.test(content)) {
    return undefined;
  }
  const sed = sedSubstitution.exec(content);
  if (sed !== null) {
    const replaced = directiveIn(sed[3] ?? "");
    // The rest of the line can still append the directive, as in `sed ... || echo ... >> sshd_config`.
    const rest = content.replace(sedSubstitution, "");
    return replaced ?? (/>>|\btee\b/.test(rest) ? directiveIn(rest) : undefined);
  }
  if (sshdOption.test(content)) {
    return directiveIn(content);
  }
  if (wholeLine.test(content) || writes.test(content)) {
    // Not as an ssh client's option, as in `ssh -o PasswordAuthentication=yes`.
    return /(?:^|\s)-o\s*["']?\w+=/.test(content) && !/\bsshd\b/.test(content) ? undefined : directiveIn(content);
  }
  return undefined;
}
