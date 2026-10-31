import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakPasswordHashingRule } from "../../src/rules/weak-password-hashing.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakPasswordHashingRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakPasswordHashingReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth/password.js", [
      "const ITERATIONS = 1000;",
      "const hash = await bcrypt.hash(password, 8);",
      "const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Password hashed with too little work");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 hash passwords or derive keys with too little work (bcrypt cost 8, below 10; PBKDF2 iterations 1,000, below 100,000), so a leaked hash can be guessed far faster on a GPU."
  );
}

export function testWeakPasswordHashingReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/auth.ts", ["const salt = bcrypt.genSaltSync(5);"]],
    ["src/auth.ts", ["crypto.scrypt(password, salt, 64, { N: 1024 }, callback);"]],
    ["app/auth.py", ['key = hashlib.pbkdf2_hmac("sha256", password, salt, 10_000)']],
    ["app/auth.py", ["kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=1000)"]],
    ["app/auth.py", ["salt = bcrypt.gensalt(rounds=4)"]],
    ["src/Auth.java", ["KeySpec spec = new PBEKeySpec(password, salt, 1024, 256);"]],
    ["src/Auth.java", ["PasswordEncoder encoder = new BCryptPasswordEncoder(4);"]],
    ["Services/Auth.cs", ["using var kdf = new Rfc2898DeriveBytes(password, salt, 1000, HashAlgorithmName.SHA256);"]],
    ["auth.go", ["key := pbkdf2.Key(password, salt, 4096, 32, sha256.New)"]],
    ["auth.go", ["hash, err := bcrypt.GenerateFromPassword(password, bcrypt.MinCost)"]],
    ["src/auth.php", ["$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 6]);"]],
    ["lib/auth.rb", ["BCrypt::Password.create(password, cost: 4)"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakPasswordHashingSkipsEnoughWorkAndUnknownValues(): void {
  const cases: Array<[string, string[]]> = [
    // Enough work.
    ["src/auth.js", ["const hash = await bcrypt.hash(password, 12);", "crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');"]],
    ["app/auth.py", ['key = hashlib.pbkdf2_hmac("sha256", password, salt, 2 ** 20)']],
    ["auth.go", ["hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)"]],
    // Values read from configuration or chosen at run time are not known.
    ["src/auth.js", ["const hash = await bcrypt.hash(password, config.saltRounds);"]],
    ["src/auth.js", ["const salt = await bcrypt.genSalt(process.env.NODE_ENV === 'test' ? 1 : 12);"]],
    // A salt as the second argument of bcrypt.hash, and comments.
    ["src/auth.js", ["const hash = await bcrypt.hash(password, salt);"]],
    ["src/auth.js", ["// bcrypt.hash(password, 4)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakPasswordHashingSkipsTestsAndCanBeDisabled(): void {
  // Tests lower the cost on purpose, so they run fast.
  const line = "const hash = await bcrypt.hash(password, 1);";
  assert.deepEqual(findings([added("src/auth.test.js", [line]), added("test/helpers.js", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { weakPasswordHashing: { enabled: false } } });
  assert.deepEqual(findings([added("src/auth.js", [line])], config), []);
}
