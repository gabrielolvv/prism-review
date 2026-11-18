import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { jwtSignatureBypassRule } from "../../src/rules/jwt-signature-bypass.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return jwtSignatureBypassRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testJwtSignatureBypassReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/controllers/application_controller.rb", [
      "def current_user",
      "  payload, _header = JWT.decode(bearer_token, nil, false)",
      "  User.find(payload[\"sub\"])",
      "end"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Token accepted without a signature check");
  assert.deepEqual(finding?.lines, [2]);
  assert.equal(
    finding?.message,
    "Line 2 turns off Ruby's jwt's signature verification for JSON Web Tokens, so anyone can write a token with the claims they want, such as another user's ID or an admin role, and have it accepted."
  );
}

export function testJwtSignatureBypassReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    // .NET, including a signature validator lambda on its own lines.
    ["src/Api/Startup.cs", ["options.TokenValidationParameters = new TokenValidationParameters", "{", "    RequireSignedTokens = false,", "};"]],
    ["src/Api/Startup.cs", ["    ValidateIssuer = true,", "    SignatureValidator = (token, parameters) =>", "        new JwtSecurityToken(token),"]],
    // Java and Kotlin libraries.
    ["src/main/java/auth/TokenFilter.java", ["JwtConsumer consumer = new JwtConsumerBuilder()", "    .setSkipSignatureVerification()", "    .build();"]],
    ["src/main/java/auth/TokenFilter.java", ["Claims claims = Jwts.parser().unsecured().build().parseUnsecuredClaims(token).getPayload();"]],
    ["src/main/kotlin/auth/Tokens.kt", ["val verifier = JWT.require(Algorithm.none()).build()"]],
    // Go, JavaScript, PHP, and Rust.
    ["internal/auth/middleware.go", ["\ttok, err := jwt.ParseString(raw, jwt.WithVerify(false))"]],
    ["internal/auth/middleware.go", ["\treturn jwt.UnsafeAllowNoneSignatureType, nil"]],
    ["src/auth.ts", ["const { payload } = UnsecuredJWT.decode(token);"]],
    ["src/Auth/TokenParser.php", ["$config = Configuration::forUnsecuredSigner();"]],
    ["src/auth.rs", ["let mut validation = Validation::default();", "validation.insecure_disable_signature_validation();"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testJwtSignatureBypassSkipsVerifiedAndExplainedUses(): void {
  const cases: Array<[string, string[]]> = [
    // Reading the issuer first, then verifying with the key set.
    [
      "bindings/eventgrid.go",
      [
        "\tparsed, err := jwt.ParseString(token, jwt.WithVerify(false))",
        "\tissuer := parsed.Issuer()",
        "\t_, err = jwt.ParseString(token, jwt.WithKeySet(keys), jwt.WithAudience(audience))"
      ]
    ],
    // A comment that says why the token can be trusted.
    ["lib/strategy.rb", ["# The token endpoint delivers this ID token over TLS, so it is already trusted.", "claims = ::JWT.decode(token, nil, false).first"]],
    // Verifying calls, claims-only switches, library definitions, and messages.
    ["app/auth.rb", ["payload, _ = JWT.decode(token, secret, true, { algorithm: \"HS256\" })"]],
    ["src/Api/Startup.cs", ["    RequireSignedTokens = true,", "    ValidateIssuerSigningKey = true,"]],
    ["impl/DefaultJwtParser.java", ["    public Jwt<Header, Claims> parseClaimsJwt(CharSequence jwt) {"]],
    ["impl/DefaultJwtParser.java", ["    String msg = \"To allow them to be parsed, call the JwtParserBuilder.unsecured() method.\";"]],
    ["src/main/java/Ops.java", ["    value = \"EXS_EXCEPTION_SOFTENING_NO_CONSTRAINTS\","]],
    // Comments.
    ["src/auth.ts", ["// UnsecuredJWT.decode(token) would skip the signature check"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testJwtSignatureBypassSkipsTestsAndCanBeDisabled(): void {
  const lines = ["payload, _ = JWT.decode(token, nil, false)"];
  assert.deepEqual(findings([added("spec/auth_spec.rb", lines)]), []);
  assert.deepEqual(findings([added("test/fixtures/auth.rb", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { jwtSignatureBypass: { enabled: false } } });
  assert.deepEqual(findings([added("app/auth.rb", lines)], config), []);
}
