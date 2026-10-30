import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { plaintextPasswordRule } from "../../src/rules/plaintext-password.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return plaintextPasswordRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPlaintextPasswordReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth.js", [
      "const user = await User.findOne({ email });",
      "if (user.password === req.body.password) {",
      "  return login(user);",
      "}",
      "if (!admin || admin.password !== password) return res.status(401).end();"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Password compared in plain text");
  assert.deepEqual(finding?.lines, [2, 5]);
  assert.equal(
    finding?.message,
    "Lines 2, 5 compare the password a user typed with the stored password directly, which means passwords are stored as they were typed: anyone who reads the database, a backup, or a log of it has every user's password."
  );
}

export function testPlaintextPasswordReadsEachLanguage(): void {
  const cases: Array<[string, string]> = [
    ["src/models/user.js", "  return candidate === this.password;"],
    ["app/auth.py", "if user and user.password == request.form['password']:"],
    ["app/auth.py", "if row['password'] != password:"],
    ["app/models/user.rb", "return user if user && user.password == params[:password]"],
    ["src/Auth.php", "if ($user['password'] == $_POST['password']) {"],
    ["src/Auth.php", "if ($user->password === $password) {"],
    ["src/main/java/Auth.java", "if (user.getPassword().equals(password)) {"],
    ["src/main/java/Auth.java", 'if (!account.getPassword().equals(request.getParameter("password"))) {'],
    ["Services/Auth.cs", "if (user.Password == password) { }"],
    ["internal/auth.go", "if user.Password != password {"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testPlaintextPasswordSkipsHashesAndOtherChecks(): void {
  const cases: Array<[string, string]> = [
    // Hashing and verification.
    ["src/auth.js", "if (await bcrypt.compare(req.body.password, user.passwordHash)) {"],
    ["src/auth.js", "if (user.passwordHash === hash(password)) {"],
    ["app/auth.py", "if not check_password(password, user.password):"],
    ["app/auth.py", "if user.password_digest == digest:"],
    ["src/Auth.php", "if (password_verify($_POST['password'], $user['password'])) {"],
    ["src/main/java/Auth.java", "if (encoder.matches(password, user.getPassword())) {"],
    // Confirmation fields, both from the form.
    ["src/auth.js", "if (req.body.password !== req.body.confirmPassword) {"],
    ["src/auth.js", "if (password !== confirmPassword) return;"],
    ["src/form.js", "if (form.password === form.passwordConfirmation) {"],
    ["src/main/java/Auth.java", "if (newPassword.equals(oldPassword)) {"],
    // Checks of whether a password is there, and equals methods.
    ["src/auth.js", "if (user.password === undefined) {"],
    ["src/auth.js", "if (typeof user.password !== 'string') {"],
    ["src/auth.js", "if (password.length < 8) {"],
    ["app/auth.py", "return self.password == other.password"],
    ["src/auth.js", "// if (user.password === req.body.password)"]
  ];
  for (const [path, line] of cases) {
    assert.deepEqual(findings([added(path, [line])]), [], `${path}: ${line}`);
  }
}

export function testPlaintextPasswordSkipsTestsAndOtherFiles(): void {
  const line = "if (user.password === req.body.password) {";

  assert.deepEqual(findings([added("src/auth.test.js", [line]), added("fixtures/auth.js", [line]), added("docs/auth.md", [line])]), []);
}

export function testPlaintextPasswordCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { plaintextPassword: { enabled: false } } });

  assert.deepEqual(findings([added("src/auth.js", ["if (user.password === req.body.password) {"])], config), []);
}
