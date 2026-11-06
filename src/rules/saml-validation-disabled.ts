import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; high?: boolean; pattern: RegExp; context?: RegExp; pairedWith?: RegExp; unlessFile?: RegExp };

const falseValue = String.raw`["']?\s*[:=]+>?\s*["']?(?:false|False|0)["']?\b`;
const key = (name: string): RegExp => new RegExp(String.raw`(?:^|[\s{,(.\[])["':]?${name}${falseValue}`);

const settings: Setting[] = [
  // gosaml2's switch that accepts responses without checking their signature.
  { label: "the signature check (gosaml2's `SkipSignatureValidation`)", high: true, pattern: /\bSkipSignatureValidation\s*[:=]\s*true\b/ },
  // Keycloak's identity provider setting that accepts unsigned SAML responses.
  { label: "the signature check (Keycloak's `validateSignature`)", high: true, pattern: key("validateSignature"), context: /keycloak|identityProvider|"providerId"\s*:\s*"saml"|saml/i },
  // node-saml and passport-saml accept unsigned responses only when both switches are off.
  {
    label: "the signature check (node-saml's `wantAssertionsSigned` and `wantAuthnResponseSigned`)",
    high: true,
    pattern: key("wantAuthnResponseSigned"),
    pairedWith: key("wantAssertionsSigned")
  },
  {
    label: "the signature check (node-saml's `wantAssertionsSigned` and `wantAuthnResponseSigned`)",
    high: true,
    pattern: key("wantAssertionsSigned"),
    pairedWith: key("wantAuthnResponseSigned")
  },
  // pysaml2's switch that accepts a response when neither it nor its assertion is signed.
  { label: "the signature check (pysaml2's `want_assertions_or_response_signed`)", high: true, pattern: key("want_assertions_or_response_signed") },
  {
    label: "the signature check (pysaml2's `want_response_signed` and `want_assertions_signed`)",
    high: true,
    pattern: key("want_response_signed"),
    pairedWith: key("want_assertions_signed"),
    unlessFile: /\bwant_assertions_or_response_signed["']?\s*[:=]\s*["']?(?:True|true)\b/
  },
  {
    label: "the signature check (pysaml2's `want_response_signed` and `want_assertions_signed`)",
    high: true,
    pattern: key("want_assertions_signed"),
    pairedWith: key("want_response_signed"),
    unlessFile: /\bwant_assertions_or_response_signed["']?\s*[:=]\s*["']?(?:True|true)\b/
  },
  // python3-saml's and php-saml's strict mode, which checks the destination, audience, and replays.
  { label: "strict mode (python3-saml's and php-saml's `strict`)", pattern: key("strict"), context: /onelogin|saml|["']idp["']\s*:|["']sp["']\s*:/i },
  // ruby-saml's options that skip a response's audience, destination, and validity checks.
  {
    label: "ruby-saml's audience, destination, or validity checks",
    pattern: /\b(?:skip_audience|skip_destination|skip_recipient_check|skip_subject_confirmation|skip_conditions|skip_authnstatement)\s*(?::|=>)\s*true\b/,
    context: /saml/i
  },
  // samlify's XML schema validator replaced by one that accepts everything, which lets signature
  // wrapping through.
  { label: "the XML schema check (samlify's `setSchemaValidator`)", high: true, pattern: /\bsetSchemaValidator\s*\(\s*\{\s*validate\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*(?:Promise\.resolve|["'`]|true\b)/ }
];

const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|cs|php|json|ya?ml|xml|properties|env)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|<!--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const samlValidationDisabledRule: Rule = {
  id: "saml-validation-disabled",
  description: "Flags SAML service providers set to skip signature, schema, audience, or destination checks on login responses.",
  run({ files, config }) {
    if (!config.rules.samlValidationDisabled.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test setups.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = `${file.path}\n${lines.map(({ content }) => content).join("\n")}`;
      const active = settings.filter(
        ({ context, pairedWith, unlessFile }) =>
          (context === undefined || context.test(text)) &&
          (pairedWith === undefined || lines.some(({ content }) => pairedWith.test(content))) &&
          (unlessFile === undefined || !unlessFile.test(text))
      );
      if (active.length === 0) {
        return [];
      }
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; label: string; high: boolean }> = [];
      // Python docstrings describe the settings, as the libraries' own do.
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (wasInDocstring || !added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (python && (insidePythonSignature(lines, index) || insideDefaultsTable(lines, index))) {
          return;
        }
        const setting = active.find(({ pattern }) => pattern.test(content));
        if (setting !== undefined) {
          found.push({ line, label: setting.label, high: setting.high === true });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      const high = found.some(({ high: isHigh }) => isHigh);
      return [
        {
          ruleId: "saml-validation-disabled",
          title: "SAML login checks turned off",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "turn" : "turns"} off ${listOf(labels)} for SAML logins, so ${
            high
              ? "anyone can forge or alter a login response and sign in as any user, including an administrator"
              : "a response meant for another application, or one replayed later, can sign a user in"
          }.`,
          recommendation:
            "Keep the library's checks on: require signed responses or assertions, keep strict mode and the schema check, and check the audience, destination, and validity window. When an identity provider cannot sign, fix that at the provider rather than accepting unsigned logins."
        }
      ];
    });
  }
};

// Whether the line is a parameter's default in a Python function's signature, as in a library's
// `def __init__(self, want_assertions_signed=False)`.
function insidePythonSignature(lines: Array<{ content: string }>, index: number): boolean {
  for (let before = index; before >= Math.max(0, index - 30); before -= 1) {
    const content = lines[before]?.content ?? "";
    if (before < index && /\)\s*(?:->[^:]*)?:\s*(?:#.*)?$/.test(content)) {
      return false;
    }
    if (/^\s*(?:async\s+)?def\s+\w+\s*\(/.test(content)) {
      return true;
    }
  }
  return false;
}

// Whether the line is in a table of a library's defaults, such as `attribute_defaults = {`.
function insideDefaultsTable(lines: Array<{ content: string }>, index: number): boolean {
  for (let before = index - 1; before >= Math.max(0, index - 20); before -= 1) {
    const name = /^\s*(\w+)\s*(?::[^=]*)?=\s*\{\s*$/.exec(lines[before]?.content ?? "")?.[1];
    if (name !== undefined) {
      return /default/i.test(name);
    }
  }
  return false;
}
