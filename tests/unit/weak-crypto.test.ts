import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakCryptoRule } from "../../src/rules/weak-crypto.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakCryptoRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakCryptoReportsEachKind(): void {
  const [finding] = findings([
    added("src/auth.ts", [
      'const digest = crypto.createHash("md5").update(password).digest("hex");',
      'const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);',
      'const ecb = crypto.createCipheriv("aes-128-ecb", key, null);',
      "const resetToken = Math.random().toString(36).slice(2);"
    ])
  ]);

  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [1, 2, 3, 4]);
  assert.equal(
    finding?.message,
    "Lines 1, 2, 3, 4 use cryptography that hashes a secret with MD5 or SHA-1, encrypts with DES, 3DES, RC4, RC2, or Blowfish, encrypts in ECB mode, which shows where the plaintext repeats, and makes a secret value with a random generator that is not meant for security."
  );
}

export function testWeakCryptoReadsOtherLanguages(): void {
  const cases: Array<[string, string]> = [
    ["app/users.py", "hashed = hashlib.sha1(user_password.encode()).hexdigest()"],
    ["app/otp.py", "otp = ''.join(random.choice(string.digits) for _ in range(6))"],
    ["app/crypto.py", "cipher = AES.new(key, AES.MODE_ECB)"],
    ["src/main/java/Crypto.java", 'Cipher cipher = Cipher.getInstance("AES");'],
    ["src/main/java/Legacy.java", 'Cipher cipher = Cipher.getInstance("DESede/CBC/PKCS5Padding");'],
    ["lib/auth.php", "$hash = md5($password);"],
    ["pkg/legacy/cipher.go", "block, err := des.NewTripleDESCipher(key)"],
    ["Crypto.cs", "using var des = TripleDES.Create();"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, path);
  }
}

export function testWeakCryptoSkipsSafeUses(): void {
  const safe = [
    // MD5 and SHA-1 for checksums and cache keys, and non-secret random numbers.
    'const etag = crypto.createHash("md5").update(body).digest("hex");',
    "checksum = hashlib.sha1(file_bytes).hexdigest()",
    "const jitter = Math.random() * 100;",
    "sample = random.choice(tokens)",
    "tokenizer = random.choice(tokenizers)",
    "footprint = random.random()",
    // Strong choices.
    'const hash = await bcrypt.hash(password, 12);',
    'const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);',
    "token = secrets.token_urlsafe(32)",
    '// const legacy = crypto.createCipheriv("des-cbc", key, iv);'
  ];
  assert.deepEqual(findings([added("src/util.ts", safe)]), []);

  const lines = ["cipher = AES.new(key, AES.MODE_ECB)"];
  assert.deepEqual(findings([added("docs/crypto.md", lines)]), []);
  assert.deepEqual(findings([added("tests/test_crypto.py", lines)]), []);
  assert.deepEqual(findings([added("app/crypto.py", lines)], prismConfigSchema.parse({ rules: { weakCrypto: { enabled: false } } })), []);
}
