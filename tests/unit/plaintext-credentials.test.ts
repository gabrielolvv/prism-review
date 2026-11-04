import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { plaintextCredentialsRule } from "../../src/rules/plaintext-credentials.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return plaintextCredentialsRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPlaintextCredentialsReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/reports.py", [
      "import ftplib, smtplib",
      "",
      "def upload(path):",
      "    ftp = ftplib.FTP('ftp.partner.io')",
      "    ftp.login(settings.FTP_USER, settings.FTP_PASSWORD)",
      "",
      "def notify(message):",
      "    server = smtplib.SMTP('smtp.acme.io', 587)",
      "    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Credentials sent without TLS");
  assert.deepEqual(finding?.lines, [4, 5, 8, 9]);
  assert.equal(
    finding?.message,
    "Lines 4, 5, 8, 9 log in over FTP and SMTP without TLS, so the username and password, and everything sent after them, cross the network in plain text that anyone on the path can read."
  );
}

export function testPlaintextCredentialsReadsEachClient(): void {
  const cases: Array<[string, string[], string]> = [
    ["src/upload.ts", ["import { Client } from 'basic-ftp';", "await client.access({", "  host: 'ftp.partner.io',", "  user: 'reports',", "  password: process.env.FTP_PASSWORD,", "});"], "FTP"],
    ["src/main/java/com/acme/Upload.java", ["FTPClient ftp = new FTPClient();", "ftp.connect(host);", "ftp.login(user, password);"], "FTP"],
    ["internal/upload/ftp.go", ["\tc, err := ftp.Dial(\"ftp.partner.io:21\")", "\terr = c.Login(user, password)"], "FTP"],
    ["src/Upload.php", ["$conn = ftp_connect('ftp.partner.io');", "ftp_login($conn, $user, $password);"], "FTP"],
    ["lib/upload.rb", ["ftp = Net::FTP.new('ftp.partner.io')", "ftp.login(user, password)"], "FTP"],
    ["src/mail.js", ["const nodemailer = require('nodemailer');", "const transport = nodemailer.createTransport({", "  host: 'smtp.acme.io',", "  ignoreTLS: true,", "  auth: { user, pass },", "});"], "SMTP"],
    ["src/main/resources/application.properties", ["spring.mail.properties.mail.smtp.auth=true", "spring.mail.properties.mail.smtp.starttls.enable=false"], "SMTP"],
    ["src/Mailer.php", ["$mail->SMTPAuth = true;", "$mail->SMTPAutoTLS = false;"], "SMTP"],
    ["Mail/Sender.cs", ["var client = new SmtpClient(\"smtp.acme.io\", 587) { EnableSsl = false, Credentials = new NetworkCredential(user, password) };"], "SMTP"],
    ["app/directory.py", ["conn = ldap.initialize('ldap://ldap.acme.io')", "conn.simple_bind_s(bind_dn, password)"], "LDAP"],
    ["src/ldap.ts", ["import ldap from 'ldapjs';", "const client = ldap.createClient({ url: 'ldap://ldap.acme.io' });", "client.bind(dn, password, callback);"], "LDAP"],
    ["internal/auth/ldap.go", ["\tl, err := ldap.DialURL(\"ldap://ldap.acme.io:389\")", "\terr = l.Bind(bindDN, password)"], "LDAP"],
    ["src/Directory.php", ["$ds = ldap_connect('ldap://ldap.acme.io');", "ldap_bind($ds, $dn, $password);"], "LDAP"],
    ["app/router.py", ["tn = telnetlib.Telnet(host)", "tn.read_until(b'Password: ')", "tn.write(password.encode() + b'\\n')"], "Telnet"]
  ];
  for (const [path, lines, label] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.includes(`over ${label} without TLS`), `${path}: ${result[0]?.message}`);
  }
}

export function testPlaintextCredentialsSkipsTlsAndLocalServers(): void {
  const cases: Array<[string, string[]]> = [
    // TLS forms and upgrades.
    ["app/reports.py", ["ftp = ftplib.FTP_TLS('ftp.partner.io')", "ftp.login(user, password)", "ftp.prot_p()"]],
    ["app/mail.py", ["server = smtplib.SMTP('smtp.acme.io', 587)", "server.starttls()", "server.login(user, password)"]],
    ["app/mail.py", ["server = smtplib.SMTP_SSL('smtp.acme.io', 465)", "server.login(user, password)"]],
    ["src/upload.ts", ["import { Client } from 'basic-ftp';", "await client.access({ host, user, password, secure: true });"]],
    ["app/directory.py", ["conn = ldap.initialize('ldap://ldap.acme.io')", "conn.start_tls_s()", "conn.simple_bind_s(bind_dn, password)"]],
    ["src/Directory.php", ["$ds = ldap_connect('ldaps://ldap.acme.io');", "ldap_bind($ds, $dn, $password);"]],
    // A local relay, and a client without a login.
    ["app/mail.py", ["server = smtplib.SMTP('localhost')", "server.login(user, password)"]],
    ["app/mail.py", ["server = smtplib.SMTP('smtp.acme.io')", "server.sendmail(sender, recipients, message)"]],
    // Telnet only when the device is configured for it, and LDAP encryption from settings.
    ["app/connection.py", ["        if self.protocol == 'telnet':", "            self.remote_conn = telnetlib.Telnet(self.host, port=self.port)", "            self.telnet_login(password=self.password)"]],
    ["lib/ldap/connection.rb", ["ldap_options[:encryption] = config['encryption'] if config['encryption']", "@ldap = Net::LDAP.new(ldap_options)", "@ldap.auth(dn, password)"]],
    // Other `access` and `.login` calls.
    ["src/session.ts", ["await session.access({ user, password });"]],
    // Development setups and tests.
    ["examples/ftp/upload.py", ["ftp = ftplib.FTP('ftp.partner.io')", "ftp.login(user, password)"]],
    ["tests/test_upload.py", ["ftp = ftplib.FTP('ftp.partner.io')", "ftp.login(user, password)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPlaintextCredentialsCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { plaintextCredentials: { enabled: false } } });
  assert.deepEqual(findings([added("app/reports.py", ["ftp = ftplib.FTP('ftp.partner.io')", "ftp.login(user, password)"])], config), []);
}
