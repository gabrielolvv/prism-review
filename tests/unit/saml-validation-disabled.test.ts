import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { samlValidationDisabledRule } from "../../src/rules/saml-validation-disabled.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return samlValidationDisabledRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSamlValidationDisabledReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/auth/saml.ts", [
      "const saml = new SAML({",
      "  idpCert: process.env.IDP_CERT,",
      "  wantAssertionsSigned: false,",
      "  wantAuthnResponseSigned: false,",
      "});"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "SAML login checks turned off");
  assert.deepEqual(finding?.lines, [3, 4]);
  assert.equal(
    finding?.message,
    "Lines 3, 4 turn off the signature check (node-saml's `wantAssertionsSigned` and `wantAuthnResponseSigned`) for SAML logins, so anyone can forge or alter a login response and sign in as any user, including an administrator."
  );
}

export function testSamlValidationDisabledWarnsForOtherChecks(): void {
  const [finding] = findings([added("app/controllers/saml_controller.rb", ["    response = OneLogin::RubySaml::Response.new(params[:SAMLResponse], settings: settings, skip_audience: true)"])]);

  assert.equal(finding?.severity, "warning");
  assert.equal(
    finding?.message,
    "Line 1 turns off ruby-saml's audience, destination, or validity checks for SAML logins, so a response meant for another application, or one replayed later, can sign a user in."
  );
}

export function testSamlValidationDisabledReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    ["internal/sso/provider.go", ["\tsp := &saml2.SAMLServiceProvider{", "\t\tSkipSignatureValidation: true,", "\t}"]],
    ["realm/realm-export.json", ["\"identityProviders\": [{", "  \"providerId\": \"saml\",", "  \"config\": {", "    \"validateSignature\": \"false\"", "  }", "}]"]],
    ["sso/sp_conf.py", ["CONFIG = {", "    'service': {'sp': {", "        'want_assertions_or_response_signed': False,", "    }},", "}"]],
    ["sso/sp_conf.py", ["        'want_response_signed': False,", "        'want_assertions_signed': False,"]],
    ["saml/settings.json", ["{", "  \"strict\": false,", "  \"sp\": { \"entityId\": \"https://app.acme.io/metadata\" },", "  \"idp\": { \"entityId\": \"https://idp.acme.io\" }", "}"]],
    ["src/sso.ts", ["samlify.setSchemaValidator({ validate: () => Promise.resolve('skipped') });"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSamlValidationDisabledSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Checks kept on, or only one of node-saml's two switches off, which still requires a signature.
    ["src/auth/saml.ts", ["  wantAssertionsSigned: true,", "  wantAuthnResponseSigned: true,"]],
    ["src/auth/saml.ts", ["  wantAuthnResponseSigned: false,"]],
    ["internal/sso/provider.go", ["\t\tSkipSignatureValidation: false,"]],
    ["sso/sp_conf.py", ["        'want_response_signed': False,", "        'want_assertions_signed': True,"]],
    ["sso/sp_conf.py", ["        'want_assertions_or_response_signed': True,", "        'want_response_signed': False,", "        'want_assertions_signed': False,"]],
    ["saml/settings.json", ["{", "  \"strict\": true,", "  \"sp\": {}", "}"]],
    // `strict` and `validateSignature` in files that are not about SAML.
    ["tsconfig.base.json", ["{ \"compilerOptions\": { \"strict\": false } }"]],
    ["src/webhooks.ts", ["const options = { validateSignature: false };"]],
    // A library's parameter defaults and its table of defaults.
    ["src/saml2/response.py", ["    def __init__(", "        self,", "        want_assertions_signed=False,", "        want_assertions_or_response_signed=False,", "        want_response_signed=False,", "    ):"]],
    ["src/saml2/client_base.py", ["        attribute_defaults = {", "            \"want_response_signed\": True,", "            \"want_assertions_or_response_signed\": False,", "        }"]],
    // Docstrings, development settings, examples, and documentation.
    ["sso/config.py", ["\"\"\"", "Set want_assertions_or_response_signed: False to accept unsigned responses.", "\"\"\""]],
    ["config/saml.dev.json", ["{ \"strict\": false, \"sp\": {}, \"idp\": {} }"]],
    ["examples/express/app.js", ["  wantAssertionsSigned: false,", "  wantAuthnResponseSigned: false,"]],
    ["docs/saml.md", ["  wantAssertionsSigned: false,", "  wantAuthnResponseSigned: false,"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSamlValidationDisabledSkipsTestsAndCanBeDisabled(): void {
  const lines = ["\t\tSkipSignatureValidation: true,"];
  assert.deepEqual(findings([added("internal/sso/provider_test.go", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { samlValidationDisabled: { enabled: false } } });
  assert.deepEqual(findings([added("internal/sso/provider.go", lines)], config), []);
}
