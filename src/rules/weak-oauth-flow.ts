import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "implicit" | "state" | "pkce" | "redirect";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  implicit: "the implicit flow, which hands tokens to the browser in the URL",
  state: "the state check that stops login CSRF",
  pkce: "PKCE, which stops a stolen authorization code from being used",
  redirect: "redirect URIs that match any address, which send codes and tokens to whoever asks"
};

const code = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|groovy|scala|cs|php)$/i;
const config = /\.(?:ya?ml|json|properties|toml|env|tf)$/i;

const settings: Array<{ kind: Kind; files: RegExp; pattern: RegExp; context?: RegExp }> = [
  // The implicit flow: a token or ID token and token as the response type, the grant type, and the
  // switches that allow it in Keycloak, IdentityServer, Spring, and Azure AD app manifests.
  {
    kind: "implicit",
    files: /./,
    pattern: /\bresponse_?type["']?\s*[:=]\s*["'](?:token|id_token\s+token|token\s+id_token)["']|[?&]response_type=(?:token|id_token(?:%20|\+)token)\b/i
  },
  {
    kind: "implicit",
    files: /./,
    pattern: /["']?implicitFlowEnabled["']?\s*[:=]\s*true\b|\bAllowAccessTokensViaBrowser\s*=\s*true\b|\bauthorization-grant-type\s*[:=]\s*["']?implicit\b|["']oauth2AllowImplicitFlow["']\s*:\s*true\b|["']oauth2AllowIdTokenImplicitFlow["']\s*:\s*true\b|\bGrantTypes\.Implicit(?:AndClientCredentials)?\b|\ballow_implicit_flow\s*=\s*true\b/
  },
  // A client registration that asks for the implicit grant.
  { kind: "implicit", files: config, pattern: /["']?grant_types["']?\s*:\s*\[[^\]]*["']?implicit\b/ },
  // The state check turned off: passport's OAuth 2.0 strategies, OmniAuth, next-auth and Auth.js,
  // and Spring's and Authlib's switches.
  { kind: "state", files: code, pattern: /\bstate\s*:\s*false\b/, context: /\bStrategy\b|passport|OAuth2?|oauth2?|openid/ },
  { kind: "state", files: /./, pattern: /\bprovider_ignores_state\s*(?::|=>|=)\s*true\b/ },
  { kind: "state", files: code, pattern: /\bchecks\s*:\s*\[\s*["']none["']\s*\]/ },
  // PKCE turned off in passport-openidconnect, openid-client, oidc-client, and Keycloak's adapters.
  { kind: "pkce", files: /./, pattern: /\b(?:pkce|usePKCE|usePkce|enablePkce|enablePKCE|pkce_enabled|pkceEnabled)["']?\s*[:=]\s*(?:false|False)\b|\bpkceMethod\s*:\s*false\b/, context: /oauth|oidc|openid|keycloak|auth0|authorization|okta|cognito/i },
  // Keycloak clients and other identity provider exports that accept any redirect URI or origin.
  {
    kind: "redirect",
    files: config,
    pattern: /["']?(?:redirectUris|redirect_uris|callbackUrls|CallbackURLs|allowedCallbackUrls|post\.logout\.redirect\.uris)["']?\s*[:=]\s*\[?[^\]\n]*["'](?:\*|\/\*|https?:\/\/\*)["']/i
  },
  // Terraform's Keycloak and Auth0 providers.
  { kind: "redirect", files: /\.tf$/i, pattern: /\b(?:valid_redirect_uris|callbacks|allowed_logout_urls)\s*=\s*\[[^\]]*"(?:\*|\/\*|https?:\/\/\*)"/ }
];

// Libraries that offer each flow choose one behind a condition, as keycloak-js's
// `case 'implicit':` and angular-oauth2-oidc's `if (this.oidc && ...)` do, and define it as a class
// attribute or a typed constant, as oauthlib's MobileApplicationClient and zitadel/oidc do.
const condition = /\bif\b|\belse\b|\belif\b|\bcase\b|\bswitch\b|\bwhen\b|\s\?\s/;
const classLine = /^\s*(?:export\s+)?(?:abstract\s+)?class\s/;
const typedConstant = /\b\w+\s+ResponseType\s*=/;
const guardWindow = 2;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|\.lock$|(?:^|\/)package(?:-lock)?\.json$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const weakOauthFlowRule: Rule = {
  id: "weak-oauth-flow",
  description: "Flags OAuth and OpenID Connect setups that use the implicit flow, turn off the state check or PKCE, or accept any redirect URI.",
  run({ files, config: prismConfig }) {
    if (!prismConfig.rules.weakOauthFlow.enabled) {
      return [];
    }

    const testGlobs = prismConfig.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test clients run against throwaway identity providers.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const python = /\.py$/i.test(file.path);
      const inCode = code.test(file.path);
      const found: Array<{ line: number; kind: Kind }> = [];
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|\'\'\'/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content) || typedConstant.test(content)) {
          return;
        }
        const setting = active.find(({ pattern }) => pattern.test(content));
        if (setting === undefined) {
          return;
        }
        if (inCode) {
          const before = lines.slice(Math.max(0, index - guardWindow), index + 1).map(({ content: other }) => other);
          const blocks = enclosingBlocks(lines, index);
          if ([...before, ...blocks].some((other) => condition.test(other)) || (blocks[0] !== undefined && classLine.test(blocks[0]))) {
            return;
          }
        }
        found.push({ line, kind: setting.kind });
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      return [
        {
          ruleId: "weak-oauth-flow",
          title: "Weak OAuth setup",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "weaken" : "weakens"} OAuth or OpenID Connect sign-in with ${listOf(kinds.map((kind) => labels[kind]))}, so an attacker can steal tokens or authorization codes, or sign a victim in to the attacker's account.`,
          recommendation:
            "Use the authorization code flow with PKCE, keep the state and nonce checks on, and register exact redirect URIs. Single-page apps should use the code flow with PKCE too, which OAuth 2.1 and the OAuth security best current practice require in place of the implicit flow."
        }
      ];
    });
  }
};

// Every line before that opens a block this line is in, from the nearest outward.
function enclosingBlocks(lines: Array<{ content: string }>, index: number): string[] {
  const blocks: string[] = [];
  let indent = lines[index]?.content.search(/\S/) ?? 0;
  // Far enough to reach a class above a long docstring, as oauthlib's clients have.
  for (let before = index - 1; before >= Math.max(0, index - 120) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      blocks.push(content);
      indent = start;
    }
  }
  return blocks;
}
