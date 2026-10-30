import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { staticIvRule } from "../../src/rules/static-iv.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return staticIvRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testStaticIvReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/crypto.js", [
      "const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16));",
      "const IV = Buffer.from('1234567890abcdef');",
      "const gcm = crypto.createCipheriv('aes-256-gcm', key, IV);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Encryption with a fixed IV or nonce");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 encrypt with an IV or nonce that is the same every time. With CBC, this shows which messages start the same; with GCM or ChaCha20, reusing a nonce with the same key reveals the plaintexts and lets messages be forged."
  );
}

export function testStaticIvReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    ["src/crypto.ts", ["const iv = new Uint8Array(12);", "const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);"]],
    ["app/crypto.py", ["cipher = Cipher(algorithms.AES(key), modes.CBC(b'\\x00' * 16))"]],
    ["app/crypto.py", ["IV = b'0123456789abcdef'", "cipher = AES.new(key, AES.MODE_CBC, IV)"]],
    ["app/crypto.py", ["cipher = AES.new(key, AES.MODE_GCM, nonce=b'fixednonce12')"]],
    ["src/main/java/Crypto.java", ["cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(new byte[16]));"]],
    [
      "src/main/java/Crypto.java",
      ['private static final byte[] IV = "1234567890123456".getBytes();', "cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(IV));"]
    ],
    ["src/main/java/Crypto.java", ["cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, new byte[12]));"]],
    ["internal/crypto.go", ["iv := make([]byte, aes.BlockSize)", "mode := cipher.NewCBCEncrypter(block, iv)"]],
    ["internal/crypto.go", ["nonce := make([]byte, gcm.NonceSize())", "ct := gcm.Seal(nil, nonce, plaintext, nil)"]],
    ["Services/Crypto.cs", ["aes.IV = new byte[16];"]],
    ["Services/Crypto.cs", ['aes.IV = Encoding.UTF8.GetBytes("1234567890123456");']],
    ["src/Crypto.php", ["$ct = openssl_encrypt($data, 'aes-256-cbc', $key, 0, '1234567890123456');"]],
    ["app/lib/crypto.rb", ["cipher.iv = '0' * 16"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testStaticIvSkipsRandomIvs(): void {
  const cases: Array<[string, string[]]> = [
    ["src/crypto.js", ["const iv = crypto.randomBytes(16);", "const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);"]],
    ["src/crypto.ts", ["const iv = crypto.getRandomValues(new Uint8Array(12));", "await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);"]],
    ["src/crypto.ts", ["const iv = new Uint8Array(12);", "crypto.getRandomValues(iv);", "await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);"]],
    ["app/crypto.py", ["iv = os.urandom(16)", "cipher = Cipher(algorithms.AES(key), modes.CBC(iv))"]],
    ["app/crypto.py", ["cipher = AES.new(key, AES.MODE_GCM)"]],
    [
      "src/main/java/Crypto.java",
      ["byte[] iv = new byte[16];", "new SecureRandom().nextBytes(iv);", "cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(iv));"]
    ],
    // IVs read back from the ciphertext when decrypting.
    ["src/main/java/Crypto.java", ["cipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(Arrays.copyOfRange(data, 0, 16)));"]],
    ["src/crypto.js", ["const iv = input.slice(0, 16);", "const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);"]],
    [
      "internal/crypto.go",
      ["nonce := make([]byte, gcm.NonceSize())", "if _, err := io.ReadFull(rand.Reader, nonce); err != nil {", "  return nil, err", "}", "ct := gcm.Seal(nonce, nonce, plaintext, nil)"]
    ],
    ["Services/Crypto.cs", ["aes.GenerateIV();", "var iv = aes.IV;"]],
    ["src/Crypto.php", ["$iv = random_bytes(16);", "$ct = openssl_encrypt($data, 'aes-256-cbc', $key, 0, $iv);"]],
    ["app/lib/crypto.rb", ["cipher.iv = iv = cipher.random_iv"]],
    // Options that are not encryption, and comments.
    ["src/app.js", ["const options = { iv: 'none' };"]],
    ["src/crypto.js", ["// crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16))"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testStaticIvSkipsTestsAndDocs(): void {
  const line = "crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16));";

  assert.deepEqual(findings([added("src/crypto.test.js", [line]), added("fixtures/crypto.js", [line]), added("docs/crypto.md", [line])]), []);
}

export function testStaticIvCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { staticIv: { enabled: false } } });

  assert.deepEqual(findings([added("src/crypto.js", ["crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16));"])], config), []);
}
