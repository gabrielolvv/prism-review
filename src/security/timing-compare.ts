import { patchLines } from "../analysis/added-lines.js";

// Words for a value an attacker guesses one character at a time when the comparison returns early:
// signatures, HMACs, tokens, and keys. Plain passwords are left out, since comparing one is a bigger
// problem than timing, and so are hashes and digests, which usually check a file's integrity, and
// OpenID nonces, which are not secret.
const secretWords = new Set(["signature", "sig", "hmac", "token", "secret", "apikey", "csrf", "otp"]);
const secretPairs = [
  ["api", "key"],
  ["access", "key"],
  ["secret", "key"],
  ["auth", "key"]
];
// Names about the secret, or tokens that are not secret: a lexer's `token.type` or `nextToken`, a
// page token, or .NET's CancellationToken.
const otherWords = new Set([
  "length", "len", "size", "count", "type", "types", "kind", "name", "id", "index", "idx", "value", "text", "raw", "given",
  "start", "end", "line", "col", "column", "pos", "position", "offset", "range", "loc", "location", "char",
  "next", "current", "cur", "prev", "previous", "last", "first", "peek", "lookahead", "eof",
  "page", "cursor", "continuation", "pagination", "cancellation", "cancel", "sync", "resume",
  "lexer", "parser", "syntax", "ast", "tokenizer", "expires", "expiry", "expiration", "ttl", "header", "prefix",
  "is", "has", "should", "valid", "enabled", "required", "present", "exists", "missing", "error", "errors", "status", "state",
  "ttype", "contents", "content", "method", "endpoint", "username", "user", "account", "identity", "model", "uuid", "lookup",
  "age", "max", "min", "term", "data", "class", "pointer", "ptr", "split", "strip", "lower", "upper", "omit", "verify",
  "verified", "algorithm", "alg", "use", "hash", "digest", "sub", "iss", "aud", "exp", "iat", "nbf", "scope", "claims"
]);
// Names that say the other side is about a value, not a secret, as in `signature.equals(Boolean.TYPE.getName())`.
const aboutWords = new Set(["type", "types", "kind", "class", "name", "length", "len", "size", "count", "id", "ttype", "username", "user", "method", "data"]);
// Functions that read something about a value rather than the value, as in `len(token)`.
const wrappers = new Set(["len", "length", "size", "count", "typeof", "type", "sizeof", "strlen", "cap", "isinstance", "bool", "hash"]);
// Secret-named constants a request is checked against, such as `API_KEY` or `WEBHOOK_SECRET`. Other
// constants, such as `NULL_TOKEN` or `SIGNATURE_PLAINTEXT`, name a kind of token.
const secretConstant = /(?:^|_)(?:SECRET|API_?KEY|SECRET_?KEY|AUTH_?TOKEN|ACCESS_?TOKEN|API_?TOKEN)$/;
const constant = /^_?[A-Z][A-Z0-9_]*$/;
// Receivers of an equals method comparing two objects field by field, as in `this.token == other.token`.
const sameObject = /^(?:this|that|other|self|o|obj|rhs|lhs)$/;
// Lexers, parsers, and compilers use tokens that are not secret.
const languageTooling = /(?:^|[/_.-])(?:lexer|lex|parser|parse|compiler|tokenizer|tokenize|scanner|grammar|formatter|syntax|ast)(?:[/_.-]|s\/|$)/i;

// `==`, `!=`, `===`, and `!==`, but not `<=`, `>=`, or `=>`.
const equality = /(?<![=!<>])(?:===|!==|==|!=)(?!=)/g;
// A name, member, call, or index chain, such as `req.headers['x-api-key']` or `hmac.digest('hex')`.
const chainBefore = /([\w$]+(?:\??\.[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\s*$/;
const chainAfter = /^\s*([\w$]+(?:\??\.[\w$]+|\([^()]*\)|\[[^[\]]*\])*)/;
// Methods and functions that compare two values and return at the first difference.
const equalityCalls = [
  /([\w$]+(?:\??\.[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\.(?:equals|Equals|contentEquals|SequenceEqual)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
  /\b(?:bytes\.Equal|strcmp|Arrays\.equals|Objects\.equals)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g
];
// Template strings and f-strings that insert a value are not fixed text.
const insertingText = /^\s*(?:`[^`]*\$\{|[fF]["'])/;
const literal = /^\s*(?:[bBrRuU]{0,2}["']|`(?![^`]*\$\{)|-?\d|(?:null|undefined|None|nil|NULL|nullptr|true|false|True|False|void)\b|\[\s*\]|\{\s*\}|$)/;
// Bandit's `# nosec` marks a line a reviewer already checked.
const reviewed = /#\s*nosec\b|nosemgrep/;
// A line that already uses a constant-time comparison.
const constantTime = /timingSafeEqual|compare_digest|secure_compare|hash_equals|ConstantTimeCompare|MessageDigest\.isEqual|FixedTimeEquals|constant_?time/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
// Go and Python name constants and classes in PascalCase, as in `credentials.SignatureDefault`.
const pascalCaseConstants = /\.(?:go|py)$/i;
const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

// The added lines, numbered as in the new file, that compare a signature, token, or key with an
// operator or method that stops at the first difference. It runs before redaction, which rewrites
// `token == expected` because of the word before the equals sign.
export function findTimingCompareLines(path: string, patch: string): number[] {
  if (!sourceFile.test(path) || skippedFile.test(path) || languageTooling.test(path)) {
    return [];
  }
  return patchLines(patch).flatMap(({ line, content, added }) =>
    added && content.length <= maxLineLength && !commentLine.test(content) && !constantTime.test(content) && !reviewed.test(content) && comparesSecret(content, pascalCaseConstants.test(path))
      ? [line]
      : []
  );
}

function comparesSecret(content: string, pascalCase: boolean): boolean {
  const pairs: Array<[string, string]> = [];
  for (const match of content.matchAll(equality)) {
    const left = chainBefore.exec(content.slice(0, match.index))?.[1];
    const rest = content.slice(match.index + match[0].length);
    const right = insertingText.test(rest) ? "inserted" : chainAfter.exec(rest)?.[1];
    if (left !== undefined && right !== undefined && !literal.test(rest)) {
      pairs.push([left, right]);
    }
  }
  const [method, call] = equalityCalls;
  for (const match of content.matchAll(method ?? /$^/)) {
    pairs.push([match[1] ?? "", match[2] ?? ""]);
  }
  for (const match of content.matchAll(call ?? /$^/)) {
    const args = (match[1] ?? "").split(",");
    if (args.length === 2) {
      pairs.push([args[0] ?? "", args[1] ?? ""]);
    }
  }
  return pairs.some(([left, right]) => comparesSecretPair(left.trim(), right.trim(), pascalCase));
}

function comparesSecretPair(left: string, right: string, pascalCase: boolean): boolean {
  if ([left, right].some((side) => literal.test(side) || isFixedValue(side, pascalCase))) {
    return false;
  }
  // An equals method comparing one field of two objects.
  const [leftNames, rightNames] = [namesOf(left), namesOf(right)];
  // A side with one bare name, as in `secret == self.secret`, is a value from elsewhere.
  const fromObject = (chain: string, names: string[]) => names.length > 1 || /\)\s*$/.test(chain);
  if (
    fromObject(left, leftNames) &&
    fromObject(right, rightNames) &&
    lastName(left) === lastName(right) &&
    [leftNames[0], rightNames[0]].some((name) => name !== undefined && sameObject.test(name))
  ) {
    return false;
  }
  const [leftSecret, rightSecret] = [isSecret(left), isSecret(right)];
  // A secret checked against something about another value, such as `signature.equals(Boolean.TYPE.getName())`.
  if ((leftSecret && !rightSecret && isAbout(right)) || (rightSecret && !leftSecret && isAbout(left))) {
    return false;
  }
  return leftSecret || rightSecret;
}

// Constants and enum members, which name a kind of token rather than hold one: `NULL_TOKEN`,
// `JsonToken.END_ARRAY`, `TokenBuffer.class`, or, in Go and Python, `credentials.SignatureDefault`.
function isFixedValue(chain: string, pascalCase: boolean): boolean {
  const last = lastName(chain);
  const first = namesOf(chain)[0] ?? "";
  if (constant.test(last) && last.length > 1) {
    return !secretConstant.test(last);
  }
  const call = /\)\s*$/.test(chain);
  return !call && /^[A-Z]/.test(last) && (pascalCase || /^[A-Z]/.test(first));
}

function isAbout(chain: string): boolean {
  return namesOf(chain).some((name) => wordsOf(name).some((word) => aboutWords.has(word)));
}

// Names in a chain, with Ruby's symbols read as names: `params[:token]` holds `params` and `token`.
function namesOf(chain: string): string[] {
  return chain.split(/[.[\]()'"?,:\s]+/).filter(Boolean);
}

// The last member of a chain, without the calls and indexes after it: `SIGNATURE` in `SIGNATURE[i]`,
// but `WEBHOOK_SECRET` in `ENV['WEBHOOK_SECRET']`, where the index names the value.
function lastName(chain: string): string {
  const key = /\[\s*:?["']?([\w-]+)["']?\s*\]\s*$/.exec(chain);
  if (key !== null && /\[\s*(?:["']|:)/.test(chain.slice(key.index))) {
    return key[1] ?? "";
  }
  const stripped = chain.replace(/(?:\([^()]*\)|\[[^[\]]*\])+\s*$/, "");
  return stripped.slice(stripped.lastIndexOf(".") + 1).replace(/^\?/, "");
}

// A chain names a secret when one of its names does and no name after it is about the secret
// instead, as in `token.length`. Quoted keys count as names, as in `headers['x-api-key']`.
function isSecret(chain: string): boolean {
  const names = namesOf(chain);
  const secret = names.findIndex(isSecretName);
  return (
    secret !== -1 &&
    // A numeric index, as in `token[1]`, reads one part of a lexer's tuple.
    !names.slice(secret + 1).some((name) => /^\d+$/.test(name) || wordsOf(name).some((word) => otherWords.has(word))) &&
    !names.slice(0, secret).some((name) => wrappers.has(name.toLowerCase()))
  );
}

function isSecretName(name: string): boolean {
  const words = wordsOf(name);
  if (words.some((word) => otherWords.has(word))) {
    return false;
  }
  return (
    words.some((word) => secretWords.has(word)) ||
    secretPairs.some(([first, second]) => words.some((word, index) => word === first && words[index + 1] === second))
  );
}

function wordsOf(name: string): string[] {
  return name
    .split(/[_$-]/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
