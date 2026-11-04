import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { weakOauthFlowRule } from "../../src/rules/weak-oauth-flow.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return weakOauthFlowRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWeakOauthFlowReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth.ts", [
      "passport.use(new OAuth2Strategy({",
      "  authorizationURL: 'https://idp.acme.io/authorize',",
      "  state: false,",
      "}, verify));",
      "export const authConfig = { responseType: 'id_token token', scope: 'openid profile' };"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Weak OAuth setup");
  assert.deepEqual(finding?.lines, [3, 5]);
  assert.equal(
    finding?.message,
    "Lines 3, 5 weaken OAuth or OpenID Connect sign-in with the implicit flow, which hands tokens to the browser in the URL and the state check that stops login CSRF, so an attacker can steal tokens or authorization codes, or sign a victim in to the attacker's account."
  );
}

export function testWeakOauthFlowReadsEachSetting(): void {
  const cases: Array<[string, string[], string]> = [
    ["src/login.js", ["const url = `${issuer}/authorize?client_id=${id}&response_type=token&redirect_uri=${redirect}`;"], "the implicit flow"],
    ["app/oauth.py", ["oauth.register('acme', response_type='token', client_id=CLIENT_ID)"], "the implicit flow"],
    ["realm/acme-realm.json", ["  \"implicitFlowEnabled\": true,"], "the implicit flow"],
    ["Identity/Config.cs", ["    AllowedGrantTypes = GrantTypes.Implicit,", "    AllowAccessTokensViaBrowser = true,"], "the implicit flow"],
    ["src/main/resources/application.yml", ["            authorization-grant-type: implicit"], "the implicit flow"],
    ["config/initializers/omniauth.rb", ["  provider :acme, ENV['KEY'], ENV['SECRET'], provider_ignores_state: true"], "the state check"],
    ["src/auth/[...nextauth].ts", ["  checks: ['none'],"], "the state check"],
    ["src/oidc.ts", ["import { Issuer } from 'openid-client';", "const options = { usePKCE: false };"], "PKCE"],
    ["realm/acme-realm.json", ["  \"redirectUris\": [\"*\"],"], "redirect URIs"],
    ["infra/keycloak.tf", ["  valid_redirect_uris = [\"https://app.acme.io/*\", \"*\"]"], "redirect URIs"]
  ];
  for (const [path, lines, label] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.includes(`with ${label}`), `${path}: ${result[0]?.message}`);
  }
}

export function testWeakOauthFlowSkipsTheCodeFlowAndOtherSettings(): void {
  const cases: Array<[string, string[]]> = [
    // The code flow, state and PKCE on, and exact redirect URIs.
    ["src/auth.ts", ["const config = { responseType: 'code', usePKCE: true, state: true };"]],
    ["realm/acme-realm.json", ["  \"implicitFlowEnabled\": false,", "  \"redirectUris\": [\"https://app.acme.io/callback\"],"]],
    // Libraries that offer each flow: behind a condition, as a class attribute or a typed
    // constant, as an allowed value, and in a docstring.
    ["lib/keycloak.js", ["      switch (initOptions.flow) {", "        case 'implicit':", "          this.responseType = 'id_token token'", "          break"]],
    ["lib/clients/mobile.py", ["class MobileApplicationClient(Client):", "    response_type = 'token'"]],
    ["pkg/oidc/authorization.go", ["\tResponseTypeIDToken ResponseType = \"id_token token\""]],
    ["lib/heart.py", ["    c_allowed_values = {\"grant_types\": [\"authorization_code\", \"implicit\"]}"]],
    ["lib/implicit.py", ["    \"\"\"", "    GET /authorize?response_type=token&client_id=s6BhdRkqt3", "    \"\"\""]],
    // Other `state: false` and `pkce` settings.
    ["src/store/ui.ts", ["const initial = { open: false, state: false };"]],
    ["src/features.ts", ["export const flags = { pkce: false };"]],
    // Token response types in other APIs, such as a password grant's token type.
    ["src/api.ts", ["const response = await fetch(url, { headers: { Accept: 'application/json' } });", "const tokenType = 'Bearer';"]],
    // Documentation, examples, and tests.
    ["docs/oauth.md", ["response_type=token"]],
    ["examples/spa/auth.js", ["const config = { responseType: 'id_token token' };"]],
    ["src/auth.test.ts", ["const config = { responseType: 'id_token token' };"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWeakOauthFlowCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { weakOauthFlow: { enabled: false } } });
  assert.deepEqual(findings([added("realm/acme-realm.json", ["  \"implicitFlowEnabled\": true,"])], config), []);
}
