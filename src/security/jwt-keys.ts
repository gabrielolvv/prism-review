import { patchLines } from "../analysis/added-lines.js";

// Calls that take a JSON Web Token signing or verification key, and which of their arguments holds
// it; `any` checks every argument. The pattern ends at the call's opening parenthesis.
const keyedCalls: Array<{ call: RegExp; argument: number | "any"; files?: RegExp }> = [
  // jsonwebtoken and PyJWT: jwt.sign(payload, key), jwt.verify(token, key), jwt.encode, jwt.decode.
  { call: /\bjwt\.(?:sign|verify|encode|decode)\s*\(/g, argument: 1 },
  // ruby-jwt and firebase/php-jwt.
  { call: /\bJWT(?:\.|::)(?:encode|decode)\s*\(/g, argument: 1 },
  { call: /\bnew\s+Key\s*\(/g, argument: 0, files: /\.php$/i },
  // Auth0's java-jwt and jjwt.
  { call: /\bAlgorithm\.HMAC(?:256|384|512)\s*\(/g, argument: 0 },
  { call: /\.(?:signWith|setSigningKey)\s*\(/g, argument: "any" },
  { call: /\bKeys\.hmacShaKeyFor\s*\(/g, argument: 0 },
  // golang-jwt and .NET.
  { call: /\.SignedString\s*\(/g, argument: 0 },
  { call: /\bSymmetricSecurityKey\s*\(/g, argument: 0 }
];

// A key passed by keyword in Python, such as `jwt.decode(token, key="...")`.
const keywordName = /^(?:key|secret|secret_key|signing_key)\s*=\s*/;
// Ways to turn text into the bytes a library wants: Go's []byte("..."), Java's "...".getBytes(),
// .NET's Encoding.UTF8.GetBytes("..."), and Python's "...".encode().
const byteWrappers = [/^\[\]byte\(\s*(.*?)\s*\)$/s, /^Encoding\.\w+\.GetBytes\(\s*(.*?)\s*\)$/s, /^(.*?)\s*\.(?:getBytes|encode)\(\s*[^()]*\)$/s];
// Text written in the code, with Python's b, r, and u prefixes. Interpolated strings, such as
// f-strings or `${...}`, are left out, since they usually read the key from somewhere else.
const stringLiteral = /^(?:[bBrRuU]{1,2})?(["'`])((?:\\.|(?!\1).)*)\1$/s;
// A public key or certificate verifies RS256 and ES256 tokens and may be written in the code.
const publicKey = /^-----BEGIN (?:PUBLIC KEY|CERTIFICATE|RSA PUBLIC KEY)/;

// Comments, and Python doctest examples in docstrings, such as `>>> jwt.encode(payload, 'secret')`.
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--|>>>)/;
// Only lines short enough, and naming a JWT library's call, are parsed, since this runs on patches
// before the size limit.
const maxLineLength = 1_000;
const mentionsJwt = /jwt|Key|HMAC|signWith|SignedString/i;

// The added lines, numbered as in the new file, that sign or verify a JSON Web Token with a key
// written in the call. It runs before redaction, which rewrites lines such as
// `const token = jwt.sign(...)` because of the variable's name.
export function findJwtKeyLines(path: string, patch: string): number[] {
  return patchLines(patch).flatMap(({ line, content, added }) =>
    added && content.length <= maxLineLength && mentionsJwt.test(content) && !commentLine.test(content) && hasLiteralKey(path, content)
      ? [line]
      : []
  );
}

function hasLiteralKey(path: string, content: string): boolean {
  return keyedCalls.some(({ call, argument, files }) => {
    if (files !== undefined && !files.test(path)) {
      return false;
    }
    for (const match of content.matchAll(call)) {
      const args = callArguments(content, match.index + match[0].length);
      const keys = argument === "any" ? args : args.slice(argument, argument + 1);
      if (keys.some(isLiteralKey)) {
        return true;
      }
    }
    return false;
  });
}

function isLiteralKey(argument: string): boolean {
  let value = argument.trim().replace(keywordName, "");
  for (const wrapper of byteWrappers) {
    value = wrapper.exec(value)?.[1] ?? value;
  }
  const literal = stringLiteral.exec(value);
  if (literal === null) {
    return false;
  }
  const [, quote, text = ""] = literal;
  return !(quote === "`" && text.includes("${")) && !publicKey.test(text);
}

// The arguments of a call that starts at `start`, just after its opening parenthesis, as far as the
// line goes. Commas inside strings and nested brackets do not split arguments.
function callArguments(content: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";
  for (let index = start; index < content.length; index += 1) {
    const char = content[index] ?? "";
    if (quote !== undefined) {
      current += char;
      if (char === "\\") {
        current += content[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  // A trailing comma, or a call cut off by the end of the line, leaves an empty last argument.
  if (current.trim() !== "") {
    args.push(current);
  }
  return args;
}
