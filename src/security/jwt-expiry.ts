import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { splitArguments } from "../rules/template-injection.js";

// How a library is told when a token expires, and where to look: the claims object passed to a
// call, an options object after it, or the calls chained on a builder.
type Signer = {
  files: RegExp;
  call: RegExp;
  // The argument that holds the claims, read only when it is written out as an object.
  claims?: number;
  // A claim or option that sets the expiry.
  expiry: RegExp;
  // The argument that holds options, which may set the expiry instead. A name, rather than an
  // object written out, may hold one, so the call is then not reported.
  options?: number;
  // For builders, the text of the chain up to the call that ends it.
  chainEnd?: RegExp;
};

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const signers: Signer[] = [
  // jsonwebtoken: jwt.sign(payload, key, { expiresIn }) or an `exp` claim.
  { files: javascript, call: /\bjwt\.sign\s*\(/g, claims: 0, options: 2, expiry: /\b(?:exp|expiresIn)\b\s*:/ },
  // jose: new SignJWT(claims).setExpirationTime(...).sign(key).
  { files: javascript, call: /\bnew\s+SignJWT\s*\(/g, chainEnd: /\.sign\s*\(/, expiry: /\.setExpirationTime\s*\(|\bexp\s*:/ },
  // PyJWT and ruby-jwt take the claims as the first argument.
  { files: /\.py$/i, call: /\bjwt\.encode\s*\(/g, claims: 0, expiry: /["']exp["']\s*:|\bexp\s*=/ },
  { files: /\.rb$/i, call: /\bJWT\.encode\s*\(/g, claims: 0, expiry: /\bexp:|["']exp["']\s*=>|:exp\s*=>/ },
  // golang-jwt: jwt.NewWithClaims(method, jwt.MapClaims{...}) or RegisteredClaims{ExpiresAt: ...}.
  { files: /\.go$/i, call: /\bjwt\.NewWithClaims\s*\(/g, claims: 1, expiry: /"exp"\s*:|\bExpiresAt\s*:/ },
  // jjwt and Auth0's java-jwt build the token with chained calls.
  { files: /\.(?:java|kt)$/i, call: /\bJwts\.builder\s*\(\s*\)/g, chainEnd: /\.compact\s*\(/, expiry: /\.(?:setExpiration|expiration)\s*\(|\.claim\s*\(\s*"exp"/ },
  { files: /\.(?:java|kt)$/i, call: /\bJWT\.create\s*\(\s*\)/g, chainEnd: /\.sign\s*\(/, expiry: /\.withExpiresAt\s*\(|\.withClaim\s*\(\s*"exp"/ },
  // .NET: new JwtSecurityToken(..., expires: ...) or a SecurityTokenDescriptor with Expires.
  { files: /\.cs$/i, call: /\bnew\s+JwtSecurityToken\s*\(/g, chainEnd: /\)\s*;/, expiry: /\bexpires\s*:/ },
  { files: /\.cs$/i, call: /\bnew\s+SecurityTokenDescriptor\b/g, chainEnd: /\}\s*;/, expiry: /\bExpires\s*=/ }
];

// How far, in lines, a call or a builder chain is read.
const reach = 15;
// Claims written out as an object, a dict, a hash, or a Go composite literal.
const objectLiteral = /^\s*(?:&?(?:jwt\.)?(?:MapClaims|RegisteredClaims|\w*Claims)\s*)?\{[\s\S]*\}\s*$/;

// Comments, and Python doctest examples in docstrings, such as `>>> jwt.encode({'a': 'b'}, 'secret')`.
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|>>>)/;
const maxLineLength = 1_000;
const mentionsJwt = /jwt|JWT|Jwt|SignJWT|SecurityTokenDescriptor/;
// Authlib's `jwt.encode(header, payload, key)` takes the header first, which names the algorithm.
const header = /["']alg["']\s*:/;

// The added lines, numbered as in the new file, that issue a JSON Web Token without an expiry. It
// runs before redaction, which rewrites lines such as `const token = jwt.sign({` because of the
// name, and so loses the call.
export function findJwtWithoutExpiryLines(path: string, patch: string): number[] {
  const fileSigners = signers.filter((signer) => signer.files.test(path));
  if (fileSigners.length === 0) {
    return [];
  }
  return findTokensWithoutExpiry(patchLines(patch), fileSigners);
}

function findTokensWithoutExpiry(lines: PatchLine[], fileSigners: Signer[]): number[] {
  const found: number[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength || commentLine.test(content) || !mentionsJwt.test(content)) {
      return;
    }
    // The call and the lines after it, as far as the hunk goes.
    const following: string[] = [];
    for (const next of lines.slice(index + 1, index + reach)) {
      if (next.startsHunk) {
        break;
      }
      following.push(next.content);
    }
    const text = [content, ...following].join("\n");
    for (const signer of fileSigners) {
      for (const match of content.matchAll(signer.call)) {
        const rest = text.slice((match.index ?? 0) + match[0].length);
        if (lacksExpiry(signer, rest)) {
          found.push(line);
        }
      }
    }
  });
  return [...new Set(found)];
}

function lacksExpiry(signer: Signer, rest: string): boolean {
  if (signer.chainEnd !== undefined) {
    const end = rest.search(signer.chainEnd);
    // A chain that does not end within reach may set the expiry further on.
    return end !== -1 && !signer.expiry.test(rest.slice(0, end));
  }
  const args = splitArguments(rest);
  const claims = args[signer.claims ?? 0] ?? "";
  // Claims held in a name may carry an `exp` set elsewhere.
  if (!objectLiteral.test(claims) || signer.expiry.test(claims) || header.test(claims)) {
    return false;
  }
  if (signer.options === undefined) {
    return true;
  }
  const options = args[signer.options];
  if (options === undefined || options.trim() === "") {
    return true;
  }
  return objectLiteral.test(options) && !signer.expiry.test(options);
}
