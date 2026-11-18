import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";
import { insideString } from "./llm-code-execution.js";

type Bypass = { library: string; pattern: RegExp };
type Found = { line: number; library: string };

const sourceFile = /\.(?:cs|java|kt|scala|groovy|rb|go|php|rs|py|[cm]?[jt]sx?)$/i;
const generatedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
// Library code that defines these switches, such as `public Jwt parseClaimsJwt(` or
// `func ParseInsecure(`.
const definitionLine = /^\s*(?:(?:public|private|protected|internal|static|final|override|virtual|abstract|async|export|pub(?:\([^)]*\))?)\s+)*(?:def|func|fn|function|[\w<>[\],.?]+)\s+\w+\s*\(|^\s*func\s+\([^)]*\)\s*\w+\s*\(/;

// Switches that let a token through without checking its signature, so anyone can write their own
// claims. `disabled-security-check` already reports PyJWT's `verify_signature: False`, jsonwebtoken's
// `algorithms: ["none"]`, and golang-jwt's `ParseUnverified`.
const bypasses: Bypass[] = [
  // .NET: unsigned tokens allowed, or a signature validator that returns the token unchecked.
  { library: ".NET", pattern: /\bRequireSignedTokens\s*=\s*false\b/ },
  { library: ".NET", pattern: /\bSignatureValidator\s*=[^;]*\bnew\s+(?:JwtSecurityToken|JsonWebToken)\s*\(\s*\w+\s*\)/ },
  // Ruby's jwt gem with `verify` set to false.
  { library: "Ruby's jwt", pattern: /\bJWT\.decode\s*\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*[^,()]+\s*,\s*false\b/ },
  // jose4j, Java JWT, JJWT, and Nimbus.
  { library: "jose4j", pattern: /\.(?:setSkipSignatureVerification|setDisableRequireSignature|setSkipAllValidators)\s*\(\s*\)/ },
  { library: "jose4j", pattern: /\bAlgorithmConstraints\.NO_CONSTRAINTS\b/ },
  { library: "Java JWT", pattern: /\bJWT\.require\s*\(\s*Algorithm\.none\s*\(\s*\)/ },
  { library: "JJWT", pattern: /\.unsecured\s*\(\s*\)|\.parseUnsecuredClaims\s*\(|\.parseClaimsJwt\s*\(/ },
  { library: "Nimbus JOSE", pattern: /\bPlainJWT\.parse\s*\(/ },
  // Go: lestrrat-go/jwx without verification, and golang-jwt's "none" key.
  { library: "jwx", pattern: /\bjwt\.(?:Parse(?:String|Request|Reader)?)\s*\([^)]*\bjwt\.WithVerify\s*\(\s*false\s*\)|\bjwt\.ParseInsecure\s*\(/ },
  { library: "golang-jwt", pattern: /\bjwt\.UnsafeAllowNoneSignatureType\b/ },
  // JavaScript's jose, PHP's lcobucci/jwt, and Rust's jsonwebtoken.
  { library: "jose", pattern: /\bUnsecuredJWT\.decode\s*\(/ },
  { library: "lcobucci/jwt", pattern: /\bConfiguration::forUnsecuredSigner\s*\(|\bnew\s+(?:\\?Lcobucci\\JWT\\Signer\\)?None\s*\(\s*\)/ },
  { library: "Rust's jsonwebtoken", pattern: /\.insecure_disable_signature_validation\s*\(\s*\)/ }
];

// A comment just above that says why the token can be trusted, such as "already validated by Entra ID".
const justification = /\b(?:verified|validated|trusted|safe|already|intentional(?:ly)?)\b/i;
const justificationLines = 4;
// A later call that verifies the same token with a key, as when code reads `iss` or `kid` first to
// pick the key.
const laterVerification =
  /\bWithKey(?:Set)?\s*\(|\.verify\s*\(|\bjwtVerify\s*\(|\bparse(?:Signed)?Claims(?:Jws)?\s*\(|\bparseClaimsJws\s*\(|\bverifyWith\s*\(|\bValidateToken(?:Async)?\s*\(|\bJWT\.decode\s*\([^)]*,\s*true\b|\bjwt\.Parse(?:WithClaims)?\s*\([^)]*func\b/;
const verificationLines = 25;

// The first match outside quoted text, so error messages that name a switch do not count.
function codeMatch(content: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return [...content.matchAll(global)].some((match) => !insideString(content, match.index ?? 0));
}

function bypassesIn(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || commentLine.test(content) || definitionLine.test(content)) {
      return;
    }
    // A `SignatureValidator` lambda or delegate may span lines.
    const text = /\bSignatureValidator\s*=/.test(content)
      ? lines
          .slice(index, index + 4)
          .map(({ content: next }) => next)
          .join(" ")
      : content;
    const match = bypasses.find(({ pattern }) => codeMatch(text, pattern));
    const justified = lines
      .slice(Math.max(0, index - justificationLines), index)
      .some(({ content: before }) => commentLine.test(before) && justification.test(before));
    const verified = lines.slice(index + 1, index + 1 + verificationLines).some(({ content: after }) => !commentLine.test(after) && laterVerification.test(after));
    if (match !== undefined && !justified && !verified) {
      found.push({ line, library: match.library });
    }
  });
  return found;
}

export const jwtSignatureBypassRule: Rule = {
  id: "jwt-signature-bypass",
  description:
    "Flags JSON Web Token code that turns signature verification off, such as .NET's `RequireSignedTokens = false`, Ruby's `JWT.decode(token, nil, false)`, jose4j's `setSkipSignatureVerification()`, JJWT's `unsecured()`, jwx's `WithVerify(false)`, and Rust's `insecure_disable_signature_validation()`.",
  run({ files, config }) {
    if (!config.rules.jwtSignatureBypass.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        generatedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = bypassesIn(patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text, plural } = describeLines(lineNumbers);
      const libraries = [...new Set(found.map(({ library }) => library))];
      return [
        {
          ruleId: "jwt-signature-bypass",
          title: "Token accepted without a signature check",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "turn" : "turns"} off ${listOf(libraries)}'s signature verification for JSON Web Tokens, so anyone can write a token with the claims they want, such as another user's ID or an admin role, and have it accepted.`,
          recommendation:
            "Verify every token with the issuer's key and a fixed list of algorithms before reading its claims. If you only need a field to find the key, such as `kid`, read the header, then verify the whole token with that key. If the token came straight from the issuer over TLS, as an OpenID Connect ID token from the token endpoint can, say so in a comment and keep its claims out of authorization decisions."
        }
      ];
    });
  }
};
