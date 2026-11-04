import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// A client for a protocol that sends credentials in plain text unless TLS is added. A file is
// reported when it has the client and the login, and no TLS, anywhere in the patch.
type Protocol = {
  label: string;
  files: RegExp;
  // Must appear somewhere in the patch, such as the import of the client package.
  context?: RegExp;
  client: RegExp;
  login: RegExp;
  tls: RegExp;
  // Whether the login lines are reported too. Telnet's "login" is any mention of a password.
  reportLogins?: boolean;
};

const python = /\.py$/i;
const js = /\.(?:[cm]?[jt]sx?)$/i;
const jvm = /\.(?:java|kt|groovy|scala)$/i;
const go = /\.go$/i;
const php = /\.php$/i;
const ruby = /\.rb$/i;
const csharp = /\.cs$/i;

const protocols: Protocol[] = [
  // FTP.
  { label: "FTP", files: python, client: /\bftplib\.FTP\s*\(|(?<![\w.])FTP\s*\(/, login: /\.login\s*\(/, tls: /\bFTP_TLS\b/ },
  {
    label: "FTP",
    files: js,
    context: /["'](?:basic-ftp|ftp|promise-ftp|jsftp)["']/,
    client: /\.(?:access|connect)\s*\(\s*\{/,
    login: /\bpassword\s*:/,
    tls: /\bsecure\s*:\s*(?:true|["'](?:implicit|control|both)["'])/
  },
  { label: "FTP", files: jvm, client: /\bnew\s+FTPClient\s*\(\s*\)|(?<![\w.])FTPClient\s*\(\s*\)/, login: /\.login\s*\(/, tls: /\bFTPSClient\b/ },
  { label: "FTP", files: go, client: /\bftp\.Dial\s*\(/, login: /\.Login\s*\(/, tls: /\bftp\.DialWith(?:Explicit)?TLS\b/ },
  { label: "FTP", files: php, client: /(?<![\w>])ftp_connect\s*\(/, login: /\bftp_login\s*\(/, tls: /\bftp_ssl_connect\b/ },
  { label: "FTP", files: ruby, client: /\bNet::FTP\.(?:new|open)\b/, login: /\.login\b|\bNet::FTP\.(?:new|open)\s*\([^)]*,\s*[^)]*,/, tls: /\bssl:\s*(?!false|nil)/ },
  { label: "FTP", files: csharp, client: /\bFtpWebRequest\b|\bWebRequestMethods\.Ftp\b/, login: /\.Credentials\s*=/, tls: /\.EnableSsl\s*=\s*true\b/ },
  // SMTP: logins over a connection that never upgrades to TLS.
  { label: "SMTP", files: python, client: /\bsmtplib\.SMTP\s*\(|(?<![\w.])SMTP\s*\(/, login: /\.login\s*\(/, tls: /\.starttls\s*\(|\bSMTP_SSL\b/ },
  { label: "SMTP", files: js, context: /["']nodemailer["']/, client: /\bignoreTLS\s*:\s*true\b/, login: /\bauth\s*:/, tls: /^$/ },
  {
    label: "SMTP",
    files: /\.(?:java|kt|groovy|scala|properties|ya?ml)$/i,
    client: /\bmail\.smtps?\.starttls\.enable["']?\s*[,=:]\s*["']?false\b/,
    login: /\bmail\.smtps?\.auth["']?\s*[,=:]\s*["']?true\b|\bspring\.mail\.password\b|^\s*password\s*:/,
    tls: /\bmail\.smtp\.ssl\.enable["']?\s*[,=:]\s*["']?true\b|\bmail\.smtps\.|\bstarttls\.required["']?\s*[,=:]\s*["']?true\b/
  },
  { label: "SMTP", files: php, client: /->SMTPAutoTLS\s*=\s*false\b/, login: /->SMTPAuth\s*=\s*true\b/, tls: /->SMTPSecure\s*=\s*(?:["'](?:tls|ssl)["']|PHPMailer::ENCRYPTION_)/ },
  { label: "SMTP", files: csharp, client: /\.EnableSsl\s*=\s*false\b|\bEnableSsl\s*=\s*false\b/, login: /\.Credentials\s*=|\bCredentials\s*=/, tls: /^$/ },
  // LDAP binds on ldap:// without StartTLS.
  {
    label: "LDAP",
    files: python,
    client: /\bldap\.initialize\s*\(\s*["']ldap:\/\/|(?<![\w.])Server\s*\(\s*["']ldap:\/\//,
    login: /\.simple_bind(?:_s)?\s*\(|\.bind(?:_s)?\s*\(|\bConnection\s*\([^)]*\bpassword\s*=|\bauto_bind\s*=/,
    tls: /\.start_tls(?:_s)?\s*\(|\buse_ssl\s*=\s*True\b|\bAUTO_BIND_TLS_BEFORE_BIND\b/
  },
  { label: "LDAP", files: js, context: /["'](?:ldapjs|ldapts)["']/, client: /\burl\s*:\s*["'`]ldap:\/\//, login: /\.bind\s*\(/, tls: /\.starttls\s*\(|\.startTLS\s*\(/ },
  { label: "LDAP", files: jvm, client: /\bPROVIDER_URL\s*,\s*["']ldap:\/\/|java\.naming\.provider\.url["']?\s*,\s*["']ldap:\/\//, login: /\bSECURITY_CREDENTIALS\b|java\.naming\.security\.credentials/, tls: /\bStartTlsRequest\b/ },
  { label: "LDAP", files: go, client: /\bldap\.DialURL\s*\(\s*"ldap:\/\/|\bldap\.Dial\s*\(\s*"tcp"/, login: /\.(?:Bind|UnauthenticatedBind|SimpleBind)\s*\(/, tls: /\.StartTLS\s*\(/ },
  { label: "LDAP", files: php, client: /\bldap_connect\s*\(\s*["']ldap:\/\//, login: /\bldap_bind\s*\(/, tls: /\bldap_start_tls\s*\(/ },
  { label: "LDAP", files: ruby, client: /\bNet::LDAP\.new\b/, login: /\bauth\s*(?::|=>)|\.bind\b/, tls: /\bencryption\b|\b(?:simple|start)_tls\b/ },
  // Telnet sends everything, passwords included, in plain text.
  { label: "Telnet", files: python, client: /\btelnetlib\.Telnet\s*\(|\btelnetlib3\.open_connection\s*\(/, login: /password|passwd/i, tls: /^$/, reportLogins: false },
  { label: "Telnet", files: ruby, client: /\bNet::Telnet\.new\b/, login: /\.login\s*\(|password/i, tls: /^$/, reportLogins: false },
  { label: "Telnet", files: jvm, client: /\bnew\s+TelnetClient\s*\(/, login: /password|passwd/i, tls: /^$/, reportLogins: false }
];

// A client chosen by an option, as network automation libraries such as Netmiko open Telnet only
// for devices configured for it.
const condition = /\bif\b|\belif\b|\bcase\b|\bwhen\b|\?/;
const protocolOption = /protocol|telnet|\bssl\b|\btls\b|secure|scheme|encrypt/i;
const guardWindow = 2;

// A client on the same machine, such as a local mail relay.
const localHost = /["'`](?:(?:ftp|ldap|smtp):\/\/)?(?:localhost|127\.0\.0\.1|::1)(?::\d+)?\/?["'`]/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const plaintextCredentialsRule: Rule = {
  id: "plaintext-credentials",
  description: "Flags logins sent over FTP, SMTP, LDAP, and Telnet connections without TLS.",
  run({ files, config }) {
    if (!config.rules.plaintextCredentials.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileProtocols = protocols.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileProtocols.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test code talks to throwaway servers.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const allLines = patchLines(file.patch);
      const lines = allLines.filter(({ content }) => content.length <= maxLineLength && !commentLine.test(content));
      const text = lines.map(({ content }) => content).join("\n");
      const found: Array<{ line: number; label: string }> = [];
      for (const { label, context, client, login, tls, reportLogins } of fileProtocols) {
        if ((context !== undefined && !context.test(text)) || tls.test(text)) {
          continue;
        }
        const clients = lines.filter(({ content, line }) => client.test(content) && !localHost.test(content) && !chosenByOption(allLines, line));
        const logins = lines.filter(({ content }) => login.test(content));
        if (clients.length === 0 || logins.length === 0) {
          continue;
        }
        for (const { line, added } of reportLogins === false ? clients : [...clients, ...logins]) {
          if (added && !found.some((entry) => entry.line === line)) {
            found.push({ line, label });
          }
        }
      }
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line).sort((left, right) => left - right);
      const { text: where, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "plaintext-credentials",
          title: "Credentials sent without TLS",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "log" : "logs"} in over ${listOf(labels)} without TLS, so the username and password, and everything sent after them, cross the network in plain text that anyone on the path can read.`,
          recommendation:
            "Use the protocol's TLS form: FTPS (`FTP_TLS`, `secure: true`, `FTPSClient`, `ftp_ssl_connect`) or SFTP, SMTP with `starttls()` or implicit TLS on port 465, LDAPS or LDAP with StartTLS, and SSH instead of Telnet."
        }
      ];
    });
  }
};

// Whether a check of a protocol or TLS option guards the client: in the lines just before, or
// opening its block.
function chosenByOption(lines: Array<{ line: number; content: string }>, line: number): boolean {
  const index = lines.findIndex((entry) => entry.line === line);
  if (index < 0) {
    return false;
  }
  const before = lines.slice(Math.max(0, index - guardWindow), index + 1).map(({ content }) => content);
  const blocks: string[] = [];
  let indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let at = index - 1; at >= Math.max(0, index - 30) && indent > 0; at -= 1) {
    const content = lines[at]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      blocks.push(content);
      indent = start;
    }
  }
  return [...before, ...blocks].some((content) => condition.test(content) && protocolOption.test(content));
}
