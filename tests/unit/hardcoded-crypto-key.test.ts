import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { hardcodedCryptoKeyRule } from "../../src/rules/hardcoded-crypto-key.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return hardcodedCryptoKeyRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Assembled at runtime so this file does not trip the rule it tests.
const key = ["change", "-me", "-key"].join("");

export function testHardcodedCryptoKeyReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/crypto.ts", [
      `const ENCRYPTION_KEY = '${key}';`,
      "export function encrypt(text: string) {",
      "  const iv = crypto.randomBytes(16);",
      "  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);",
      "  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');",
      "}",
      `export const sign = (data: string) => crypto.createHmac('sha256', '${key}').update(data).digest('hex');`
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Encryption key written in the code");
  assert.deepEqual(finding?.lines, [4, 7]);
  assert.equal(
    finding?.message,
    "Lines 4, 7 encrypt or sign with a key written in the code, so anyone who can read the code, its history, or the built app can decrypt the data and forge what the key protects. The key cannot be changed without a release, and every copy of the code shares it."
  );
}

export function testHardcodedCryptoKeyReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    ["src/storage.js", [`const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), '${key}').toString();`]],
    ["src/token.js", [`const mac = CryptoJS.HmacSHA256(payload, "${key}");`]],
    ["src/keys.ts", [`const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode('${key}'), 'AES-GCM', false, ['encrypt']);`]],
    ["src/cipher.js", [`const cipher = crypto.createDecipheriv(algorithm, Buffer.from('${key}'), iv);`]],
    ["app/crypto.py", [`cipher = AES.new(b'${key}', AES.MODE_GCM)`]],
    ["app/crypto.py", [`fernet = Fernet(b"${key}")`]],
    ["app/crypto.py", [`SECRET = b"${key}"`, "", "def sign(message):", "    return hmac.new(SECRET, message, hashlib.sha256).hexdigest()"]],
    ["src/main/java/com/acme/Crypto.java", [`SecretKeySpec spec = new SecretKeySpec("${key}".getBytes(StandardCharsets.UTF_8), "AES");`]],
    ["src/main/kotlin/com/acme/Crypto.kt", [`val spec = SecretKeySpec("${key}".toByteArray(), "AES")`]],
    ["internal/crypto/aes.go", [`\tblock, err := aes.NewCipher([]byte("${key}"))`]],
    ["internal/crypto/mac.go", [`\tmac := hmac.New(sha256.New, []byte("${key}"))`]],
    ["Crypto/Cipher.cs", [`aes.Key = Encoding.UTF8.GetBytes("${key}");`]],
    ["Crypto/Mac.cs", [`using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes("${key}"));`]],
    ["src/Crypto.php", [`$encrypted = openssl_encrypt($data, 'aes-256-cbc', '${key}', 0, $iv);`]],
    ["src/Crypto.php", [`$signature = hash_hmac('sha256', $payload, '${key}');`]],
    ["lib/crypto.rb", ["cipher = OpenSSL::Cipher.new('aes-256-cbc')", "cipher.encrypt", `cipher.key = '${key}'`]],
    ["lib/signature.rb", [`OpenSSL::HMAC.hexdigest('SHA256', '${key}', payload)`]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testHardcodedCryptoKeySkipsKeysFromOutsideTheCode(): void {
  const cases: Array<[string, string[]]> = [
    ["src/crypto.ts", ["const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');", "const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);"]],
    ["src/crypto.ts", ["const cipher = crypto.createCipheriv('aes-256-gcm', await getKey(), iv);", "const mac = crypto.createHmac('sha256', config.webhookSecret);"]],
    ["app/crypto.py", ["cipher = AES.new(get_random_bytes(32), AES.MODE_GCM)", "fernet = Fernet(os.environ['FERNET_KEY'])", "f = Fernet(Fernet.generate_key())"]],
    ["internal/crypto/aes.go", ["\tblock, err := aes.NewCipher([]byte(os.Getenv(\"KEY\")))"]],
    ["Crypto/Cipher.cs", ["aes.Key = Convert.FromBase64String(config[\"Crypto:Key\"]);", "entry.Key = \"name\";"]],
    // Filler an algorithm replaces, as RFC 6979's deterministic nonces start with.
    ["app/rfc6979.py", ["    k = b\"\\x00\" * holen", "    k = hmac.new(k, v + b\"\\x00\" + x, hash_func).digest()"]],
    // A key joined from other values.
    ["app/oauth.py", ["    key = b\"&\".join(key_elems)", "    hash = hmac.new(key, base_string, hashlib.sha1)"]],
    // Template placeholders, error messages that name a call, and comments.
    ["templates/crypto.py", ["cipher = AES.new(b'{{ key }}', AES.MODE_GCM)"]],
    ["src/errors.js", [`throw new Error("createCipheriv(alg, '${key}', iv) needs a 32-byte key");`]],
    ["src/crypto.js", [`// crypto.createCipheriv('aes-256-cbc', '${key}', iv)`]],
    // Documentation, examples, and tests.
    ["README.md", [`crypto.createCipheriv('aes-256-cbc', '${key}', iv)`]],
    ["examples/encrypt.js", [`crypto.createCipheriv('aes-256-cbc', '${key}', iv)`]],
    ["src/crypto.test.ts", [`crypto.createCipheriv('aes-256-cbc', '${key}', iv)`]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testHardcodedCryptoKeyFindsKeysBeforeRedaction(): void {
  // Redaction rewrites `secretKey = "..."` because of its name, so the key is found first.
  const files = prepareChangedFiles([added("src/crypto.js", [`const secretKey = "${key}";`, "const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);"])], defaultConfig);

  assert.doesNotMatch(files[0]?.patch ?? "", new RegExp(key));
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "hardcoded-crypto-key").map((finding) => finding.lines),
    [[2]]
  );
}

export function testHardcodedCryptoKeyCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { hardcodedCryptoKey: { enabled: false } } });
  assert.deepEqual(findings([added("app/crypto.py", [`fernet = Fernet(b"${key}")`])], config), []);
}
