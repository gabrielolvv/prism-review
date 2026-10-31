import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { jwtWithoutExpiryRule } from "../../src/rules/jwt-without-expiry.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return jwtWithoutExpiryRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testJwtWithoutExpiryReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("server/auth.js", [
      "callback({",
      "  ok: true,",
      "  token: jwt.sign({",
      "    username: data.username,",
      "  }, server.jwtSecret),",
      "});",
      "const refresh = jwt.sign({ sub: user.id }, secret, { algorithm: 'HS256' });"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "JWT issued without an expiry");
  assert.deepEqual(finding?.lines, [3, 7]);
  assert.equal(
    finding?.message,
    "Lines 3, 7 issue JSON Web Tokens without an expiry, so a token that leaks, through a log, a browser, or a former employee, works for as long as the signing key does, and cannot be revoked without changing it."
  );
}

export function testJwtWithoutExpiryReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    ["src/auth.ts", ["const token = await new SignJWT({ sub: user.id })", "  .setProtectedHeader({ alg: 'HS256' })", "  .sign(key);"]],
    ["app/auth.py", ['token = jwt.encode({"sub": user.id, "role": user.role}, key, algorithm="HS256")']],
    ["app/auth.rb", ["token = JWT.encode({ user_id: user.id }, secret, 'HS256')"]],
    ["auth.go", ["token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{", '\t"sub": user.ID,', "})"]],
    ["src/Auth.java", ["String token = Jwts.builder()", "    .setSubject(user.getId())", "    .signWith(key)", "    .compact();"]],
    ["src/Auth.java", ["String token = JWT.create()", '    .withSubject(user.getId())', "    .sign(algorithm);"]],
    ["Services/Auth.cs", ["var token = new JwtSecurityToken(issuer, audience, claims, signingCredentials: credentials);"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testJwtWithoutExpirySkipsTokensThatExpire(): void {
  const cases: Array<[string, string[]]> = [
    ["src/auth.js", ["const token = jwt.sign({ sub: user.id }, secret, { expiresIn: '15m' });"]],
    ["src/auth.js", ["return jwt.sign(", "  { exp: expiry.unix(), nbf: start.unix() },", "  key,", "  JWT_OPTIONS", ");"]],
    ["src/auth.ts", ["const token = await new SignJWT({ sub: user.id })", "  .setExpirationTime('15m')", "  .sign(key);"]],
    ["app/auth.py", ['token = jwt.encode({"sub": user.id, "exp": now + timedelta(minutes=15)}, key)']],
    ["auth.go", ["token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{", "\tSubject: user.ID,", "\tExpiresAt: jwt.NewNumericDate(expiry),", "})"]],
    ["src/Auth.java", ["String token = Jwts.builder()", "    .setSubject(user.getId())", "    .setExpiration(expiry)", "    .compact();"]],
    ["Services/Auth.cs", ["var token = new JwtSecurityToken(issuer, audience, claims, expires: DateTime.UtcNow.AddMinutes(15));"]],
    // Claims or options held in a name may set the expiry elsewhere.
    ["src/auth.js", ["const token = jwt.sign(payload, secret);", "const other = jwt.sign({ sub }, secret, signOptions);"]],
    // Authlib takes the header first, and doctest examples are not code.
    ["app/oidc.py", ['data = jwt.encode({"alg": alg}, user_info, key, algorithms)']],
    ["jose/jwt.py", ["    >>> jwt.encode({'a': 'b'}, 'secret', algorithm='HS256')"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testJwtWithoutExpirySkipsTestsAndCanBeDisabled(): void {
  const line = "const token = jwt.sign({ sub: user.id }, secret);";
  assert.deepEqual(findings([added("test/auth.test.js", [line]), added("fixtures/auth.js", [line]), added("docs/auth.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { jwtWithoutExpiry: { enabled: false } } });
  assert.deepEqual(findings([added("src/auth.js", [line])], config), []);
}

export function testJwtWithoutExpirySeesLinesRedactionRewrites(): void {
  // Redaction rewrites `const token = jwt.sign({` because of the name, so tokens are found before it.
  const files = prepareChangedFiles([added("src/auth.js", ["const token = jwt.sign({ sub: user.id }, secret);"])], defaultConfig);

  assert.doesNotMatch(files[0]?.patch ?? "", /jwt\.sign/);
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "jwt-without-expiry").map((finding) => finding.line),
    [1]
  );
}
