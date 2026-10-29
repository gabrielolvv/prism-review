import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { hardcodedJwtSecretRule } from "../../src/rules/hardcoded-jwt-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return hardcodedJwtSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testHardcodedJwtSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth/tokens.ts", [
      'import jwt from "jsonwebtoken";',
      'export const issue = (user: User) => jwt.sign({ sub: user.id, roles: [user.role] }, "change-me", { expiresIn: "1h" });',
      "export const check = (token: string) => jwt.verify(token, process.env.JWT_SECRET!);",
      "export const read = (token: string) => jwt.verify(token, `dev-secret`);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "JWT key written in the code");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 sign or verify JSON Web Tokens with a key written in the code, so anyone who can read the code can make tokens the application accepts."
  );
}

export function testHardcodedJwtSecretReadsEachLibrary(): void {
  const cases: Array<[string, string]> = [
    ["app/auth.py", 'token = jwt.encode({"sub": user.id}, "super-secret", algorithm="HS256")'],
    ["app/auth.py", 'claims = jwt.decode(token, key="super-secret", algorithms=["HS256"])'],
    ["app/auth.py", 'token = jwt.encode(payload, b"super-secret")'],
    ["app/auth.py", 'token = jwt.encode(payload, "super-secret".encode("utf-8"))'],
    ["app/services/token.rb", "token = JWT.encode(payload, 'super-secret', 'HS256')"],
    ["src/Auth.php", "$jwt = JWT::encode($payload, 'super-secret', 'HS256');"],
    ["src/Auth.php", "$decoded = JWT::decode($jwt, new Key('super-secret', 'HS256'));"],
    ["src/main/java/Auth.java", 'Algorithm algorithm = Algorithm.HMAC256("super-secret");'],
    ["src/main/java/Tokens.java", 'String jwt = Jwts.builder().setSubject(id).signWith(SignatureAlgorithm.HS256, "super-secret").compact();'],
    ["src/main/java/Keys.java", 'SecretKey key = Keys.hmacShaKeyFor("super-secret-that-is-long-enough-for-hs256".getBytes(StandardCharsets.UTF_8));'],
    ["internal/auth/token.go", 'signed, err := token.SignedString([]byte("super-secret"))'],
    ["Auth/TokenService.cs", 'var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("super-secret"));']
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testHardcodedJwtSecretSkipsKeysFromElsewhere(): void {
  const safe = [
    "const token = jwt.sign(payload, secret);",
    "const token = jwt.sign(payload, config.get('jwt.secret'), { algorithm: 'HS256' });",
    "const token = jwt.sign(payload, `${process.env.PREFIX}-key`);",
    "const claims = jwt.decode(token, { complete: true });",
    "const claims = jwt.decode(token);",
    'token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")',
    'claims = jwt.decode(token, options={"verify_signature": False})',
    'claims = jwt.decode(token, f"{prefix}-key")',
    "token = JWT.encode(payload, ENV.fetch('JWT_SECRET'), 'HS256')",
    'signed, err := token.SignedString(key)',
    'var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]));',
    'const claims = jwt.verify(token, "-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkq...");',
    // A JavaScript object named Key is not firebase/php-jwt's Key.
    'const key = new Key("super-secret");',
    // Comments.
    '// jwt.sign(payload, "change-me")',
    '# token = jwt.encode(payload, "change-me")',
    "    >>> jwt.encode({'a': 'b'}, 'secret', algorithm='HS256')"
  ];

  assert.deepEqual(findings([added("src/auth.ts", safe)]), []);
}

export function testHardcodedJwtSecretSeesRedactedKeys(): void {
  // Redaction rewrites a line that assigns to a variable named `token`, and replaces long keys, so
  // the keys are found before it runs.
  const longKey = "k".repeat(48);
  const files = prepareChangedFiles(
    [added("src/auth.js", ['const token = jwt.sign(payload, "change-me");', `const refreshToken = jwt.sign(payload, "${longKey}");`])],
    defaultConfig
  );

  assert.ok(!(files[0]?.patch ?? "").includes('jwt.sign(payload, "change-me")'));
  assert.doesNotMatch(files[0]?.patch ?? "", new RegExp(longKey));
  assert.deepEqual(findings(files)[0]?.lines, [1, 2]);
}

export function testHardcodedJwtSecretSkipsTestsAndDocs(): void {
  const line = 'const token = jwt.sign(payload, "change-me");';

  assert.deepEqual(findings([added("src/auth.test.ts", [line]), added("docs/auth.md", [line]), added("fixtures/jwt/app.js", [line])]), []);
}

export function testHardcodedJwtSecretCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { hardcodedJwtSecret: { enabled: false } } });

  assert.deepEqual(findings([added("src/auth.js", ['const token = jwt.sign(payload, "change-me");'])], config), []);
}
