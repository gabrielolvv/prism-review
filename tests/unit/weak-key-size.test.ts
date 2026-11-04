import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakKeySizeRule } from "../../src/rules/weak-key-size.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakKeySizeRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakKeySizeReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/keys.ts", [
      "const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {",
      "  modulusLength: 1024,",
      "});",
      "const dh = crypto.getDiffieHellman('modp2');"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Key too short");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 make keys too short to resist current attacks (1024-bit RSA and 1024-bit Diffie-Hellman). Anyone who breaks the key can forge what it signs and read what it encrypts, and 512- and 768-bit keys have been broken in public for little money."
  );
}

export function testWeakKeySizeReadsEachLanguageAndTool(): void {
  const cases: Array<[string, string[], string, "high" | "warning"]> = [
    ["src/keys.js", ["const keys = forge.pki.rsa.generateKeyPair({ bits: 512, e: 0x10001 });"], "512-bit RSA", "high"],
    ["src/keys.js", ["const key = new NodeRSA({ b: 1024 });"], "1024-bit RSA", "warning"],
    ["src/cert.js", ["const selfsigned = require('selfsigned');", "const pems = selfsigned.generate(attrs, { keySize: 1024, days: 365 });"], "1024-bit RSA", "warning"],
    ["app/keys.py", ["key = rsa.generate_private_key(", "    public_exponent=65537,", "    key_size=1024,", ")"], "1024-bit RSA", "warning"],
    ["app/keys.py", ["params = dh.generate_parameters(generator=2, key_size=768)"], "768-bit Diffie-Hellman", "high"],
    ["app/keys.py", ["key = RSA.generate(1024)"], "1024-bit RSA", "warning"],
    ["app/keys.py", ["key = paramiko.DSSKey.generate(bits=1024)"], "1024-bit DSA", "warning"],
    ["app/keys.py", ["return cls(DSAPrivateKey.generate(key_size=1024))"], "1024-bit DSA", "warning"],
    ["app/keys.py", ["key = ec.generate_private_key(ec.SECP192R1())"], "the SECP192R1 curve", "warning"],
    ["internal/keys.go", ["key, err := rsa.GenerateKey(rand.Reader, 1024)"], "1024-bit RSA", "warning"],
    ["src/main/java/com/acme/Keys.java", ["KeyPairGenerator generator = KeyPairGenerator.getInstance(\"DSA\");", "generator.initialize(1024);"], "1024-bit DSA", "warning"],
    ["src/main/java/com/acme/Keys.java", ["generator.initialize(new ECGenParameterSpec(\"secp192r1\"));"], "the secp192r1 curve", "warning"],
    ["Crypto/Keys.cs", ["using var rsa = new RSACryptoServiceProvider(1024);"], "1024-bit RSA", "warning"],
    ["Crypto/Keys.cs", ["rsaProvider.KeySize = 512;"], "512-bit RSA", "high"],
    ["lib/keys.rb", ["key = OpenSSL::PKey::RSA.new(1024)"], "1024-bit RSA", "warning"],
    ["src/Keys.php", ["$key = openssl_pkey_new(['private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);"], "1024-bit RSA", "warning"],
    ["scripts/certs.sh", ["openssl genrsa -out server.key 1024"], "1024-bit RSA", "warning"],
    ["Dockerfile", ["RUN openssl req -x509 -newkey rsa:1024 -nodes -keyout key.pem -out cert.pem -days 365"], "1024-bit RSA", "warning"],
    ["scripts/certs.sh", ["openssl dhparam -out dhparam.pem 1024"], "1024-bit Diffie-Hellman", "warning"],
    ["scripts/keys.sh", ["ssh-keygen -t rsa -b 1024 -f deploy_key -N ''"], "1024-bit RSA", "warning"],
    ["scripts/keys.sh", ["ssh-keygen -t dsa -f host_key -N ''"], "1024-bit DSA", "warning"],
    ["scripts/keystore.sh", ["keytool -genkeypair -alias app -keyalg RSA -keysize 1024 -keystore app.jks"], "1024-bit RSA", "warning"],
    ["infra/tls.tf", ["resource \"tls_private_key\" \"app\" {", "  algorithm = \"RSA\"", "  rsa_bits  = 1024", "}"], "1024-bit RSA", "warning"],
    ["k8s/certificate.yaml", ["  privateKey:", "    algorithm: RSA", "    size: 1024"], "1024-bit RSA", "warning"]
  ];
  for (const [path, lines, label, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.includes(`(${label})`), `${path}: ${result[0]?.message}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakKeySizeSkipsStrongKeysAndOtherSizes(): void {
  const cases: Array<[string, string[]]> = [
    ["src/keys.ts", ["crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });", "crypto.getDiffieHellman('modp14');"]],
    ["app/keys.py", ["key = rsa.generate_private_key(public_exponent=65537, key_size=2048)", "key = ec.generate_private_key(ec.SECP256R1())", "key = RSA.generate(bits)"]],
    // Sizes of other things: AES keys, buffers, and elliptic curve sizes.
    ["src/main/java/com/acme/Keys.java", ["KeyGenerator aes = KeyGenerator.getInstance(\"AES\");", "aes.init(256);", "list.initialize(16);"]],
    ["Crypto/Keys.cs", ["aes.KeySize = 256;", "hmac.KeySize = 128;"]],
    ["src/cache.js", ["const cache = new LRU({ keySize: 512 });"]],
    ["app/curves.py", ["known_curves = {", "    \"urn:oid:1.2.840.10045.3.1.1\": ec.SECP192R1(),", "}"]],
    ["k8s/certificate.yaml", ["  privateKey:", "    algorithm: ECDSA", "    size: 256"]],
    ["scripts/keys.sh", ["ssh-keygen -t ecdsa -b 256 -f host_key -N ''", "ssh-keygen -t ed25519 -f deploy_key", "keytool -genkeypair -keyalg EC -keysize 256", "openssl genrsa -out server.key 3072"]],
    // Comments, documentation, and examples.
    ["scripts/certs.sh", ["# openssl genrsa -out server.key 1024"]],
    ["docs/keys.md", ["openssl genrsa -out server.key 1024"]],
    ["examples/keys/make.sh", ["openssl genrsa -out server.key 1024"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakKeySizeSkipsTestsAndCanBeDisabled(): void {
  const lines = ["key = RSA.generate(1024)"];
  assert.deepEqual(findings([added("tests/test_keys.py", lines)]), []);
  assert.deepEqual(findings([added("acme/internal/acmetest/ca.go", ["\tpk, err = rsa.GenerateKey(rand.Reader, 1024)"])]), []);
  assert.equal(findings([added("internal/latest/keys.go", ["\tpk, err = rsa.GenerateKey(rand.Reader, 1024)"])]).length, 1);

  const config = prismConfigSchema.parse({ rules: { weakKeySize: { enabled: false } } });
  assert.deepEqual(findings([added("app/keys.py", lines)], config), []);
}
