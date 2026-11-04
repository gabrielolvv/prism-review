import { patchLines, type PatchLine } from "../analysis/added-lines.js";

// Calls that take an encryption or MAC key, and which argument holds it. `assigned` reads the right
// side of `.Key = ...` or `.key = ...`.
type Sink = { files: RegExp; call: RegExp; argument: number | "assigned" };

const js = /\.(?:[cm]?[jt]sx?)$/i;
const sinks: Sink[] = [
  // Node.js crypto, WebCrypto's raw keys, and CryptoJS, whose string keys are passphrases.
  { files: js, call: /\bcreate(?:Cipher|Decipher)iv\s*\(/g, argument: 1 },
  { files: js, call: /\bcreateHmac\s*\(/g, argument: 1 },
  { files: js, call: /\bsubtle\.importKey\s*\(\s*["']raw["']\s*,/g, argument: 0 },
  { files: js, call: /\bCryptoJS\.(?:AES|DES|TripleDES|Rabbit|RC4)\.(?:en|de)crypt\s*\(/g, argument: 1 },
  { files: js, call: /\bCryptoJS\.Hmac(?:SHA\d+|MD5)\s*\(/g, argument: 1 },
  // PyCryptodome, pyca/cryptography, and the standard library's hmac.
  { files: /\.py$/i, call: /\b(?:AES|DES3|ChaCha20|ChaCha20_Poly1305|Salsa20|Blowfish)\.new\s*\(/g, argument: 0 },
  { files: /\.py$/i, call: /(?<![\w.])(?:Fernet|AESGCM|AESCCM|AESSIV|AESOCB3|ChaCha20Poly1305|algorithms\.(?:AES|AES128|AES256|ChaCha20|TripleDES))\s*\(/g, argument: 0 },
  { files: /\.py$/i, call: /\bhmac\.(?:new|digest)\s*\(/g, argument: 0 },
  // Java's and Kotlin's javax.crypto.
  { files: /\.(?:java|kt|scala|groovy)$/i, call: /\bnew\s+SecretKeySpec\s*\(|(?<![\w.])SecretKeySpec\s*\(/g, argument: 0 },
  // Go.
  { files: /\.go$/i, call: /\b(?:aes|des)\.New(?:TripleDES)?Cipher\s*\(|\bchacha20poly1305\.NewX?\s*\(/g, argument: 0 },
  { files: /\.go$/i, call: /\bhmac\.New\s*\(/g, argument: 1 },
  // .NET.
  // `.Key` on an object named for a cipher or MAC, not a dictionary entry's key.
  { files: /\.cs$/i, call: /\b\w*(?:aes|rijndael|des|cipher|crypt|algorithm|hmac|symmetric)\w*\.Key\s*=(?!=)/gi, argument: "assigned" },
  { files: /\.cs$/i, call: /\bnew\s+HMAC(?:SHA\d+|MD5)\s*\(/g, argument: 0 },
  { files: /\.cs$/i, call: /\.Create(?:En|De)cryptor\s*\(/g, argument: 0 },
  // PHP's OpenSSL, hash_hmac, and libsodium.
  { files: /\.php$/i, call: /\bopenssl_(?:en|de)crypt\s*\(/g, argument: 2 },
  { files: /\.php$/i, call: /\bhash_hmac\s*\(/g, argument: 2 },
  { files: /\.php$/i, call: /\bsodium_crypto_secretbox(?:_open)?\s*\(/g, argument: 2 },
  // Ruby's OpenSSL.
  { files: /\.rb$/i, call: /\b\w*(?:cipher|aes|crypt|decipher)\w*\.key\s*=(?!=)/g, argument: "assigned" },
  { files: /\.rb$/i, call: /\bOpenSSL::HMAC\.(?:hexdigest|digest|base64digest)\s*\(/g, argument: 1 }
];

// A key written in the code: text, a byte literal, or bytes made from text or a list of numbers.
const fixedKey = new RegExp(
  [
    // The whole value, as `b"&".join(parts)` builds a key from other values.
    String.raw`^[bBrRuU]{0,2}(["'\`])(?:\\.|(?!\1).)+\1(?:\s*\.\s*(?:getBytes|encode|toByteArray)\s*\([^()]*\))?\s*$`,
    String.raw`^Buffer\.from\s*\(\s*(["'\`])(?:\\.|(?!\2).)+\2`,
    String.raw`^new\s+TextEncoder\s*\(\s*\)\s*\.encode\s*\(\s*["'\`]`,
    String.raw`^\[\]byte\s*\(\s*"[^"]+"`,
    String.raw`^\[\]byte\s*\{\s*(?:0x)?\d`,
    String.raw`^(?:System\.Text\.)?Encoding\.\w+\.GetBytes\s*\(\s*"[^"]+"`,
    String.raw`^bytes\.fromhex\s*\(\s*["']`,
    String.raw`^CryptoJS\.enc\.(?:Utf8|Hex|Base64|Latin1)\.parse\s*\(\s*["']`,
    String.raw`^new\s+byte\s*\[\s*\]\s*\{\s*(?:\(byte\)\s*)?(?:0x)?\d`,
    String.raw`^byteArrayOf\s*\(\s*(?:0x)?\d`
  ].join("|")
);
// Template placeholders and interpolated text are not keys written in the code, and neither is
// filler repeated to a length, such as RFC 6979's starting `K = b"\x00" * hlen`, which the
// algorithm replaces before use.
const placeholder = /\{\{|\{%|<%|\$\{|#\{|%\(|^\s*["'`]\s*["'`]|^[bB]?(["'])(?:\\x00|\\x01|\\0|0)\1\s*\*/;

const assignment = /^\s*(?:(?:const|let|var|final|private|public|protected|static|readonly|val|byte\[\]|\[\]byte)\s+)*(?:byte\s*\[\]\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*?);?\s*$/;
const reach = 60;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const maxLineLength = 1_000;

// The added lines, numbered as in the new file, that encrypt or sign with a key written in the
// code, directly or through a name assigned one in the lines before. It runs before redaction,
// which rewrites `key = "..."` because of its name.
export function findCryptoKeyLines(path: string, patch: string): number[] {
  const fileSinks = sinks.filter(({ files }) => files.test(path));
  if (fileSinks.length === 0) {
    return [];
  }
  const python = /\.py$/i.test(path);
  const lines = patchLines(patch);
  const found: number[] = [];
  let inDocstring = false;
  lines.forEach(({ line, content, added, startsHunk }, index) => {
    if (startsHunk) {
      inDocstring = false;
    }
    const wasInDocstring = inDocstring;
    if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
      inDocstring = !inDocstring;
    }
    if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content)) {
      return;
    }
    const keys: string[] = [];
    for (const sink of fileSinks) {
      sink.call.lastIndex = 0;
      for (const match of content.matchAll(sink.call)) {
        if (insideString(content, match.index)) {
          continue;
        }
        const rest = content.slice(match.index + match[0].length);
        const value = sink.argument === "assigned" ? rest.replace(/;\s*$/, "") : splitArguments(rest)[sink.argument];
        if (value !== undefined) {
          keys.push(value.replace(/^\s*(?:key|secret|password)\s*[=:]\s*/i, "").trim());
        }
      }
    }
    if (keys.some((key) => isFixed(key, lines, index))) {
      found.push(line);
    }
  });
  return found;
}

// A key written in the code, or a name assigned one in the lines before.
function isFixed(key: string, lines: PatchLine[], index: number): boolean {
  if (key === "") {
    return false;
  }
  if (fixedKey.test(key)) {
    return !placeholder.test(key);
  }
  const name = /^\$?([A-Za-z_][\w]*)\s*$/.exec(key)?.[1];
  const current = lines[index];
  if (name === undefined || current === undefined) {
    return false;
  }
  for (let at = index - 1; at >= 0; at -= 1) {
    const earlier = lines[at];
    if (earlier === undefined || current.line - earlier.line > reach) {
      return false;
    }
    const assigned = assignment.exec(earlier.content);
    if (assigned?.[1] === name) {
      const value = (assigned[2] ?? "").trim();
      return fixedKey.test(value) && !placeholder.test(value);
    }
  }
  return false;
}

// Whether a position is inside quoted text, as a call named in an error message is.
function insideString(content: string, index: number): boolean {
  let quote: string | undefined;
  for (let position = 0; position < index; position += 1) {
    const char = content[position];
    if (quote !== undefined) {
      if (char === "\\") {
        position += 1;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    }
  }
  return quote !== undefined;
}

// The arguments of a call from just after its opening parenthesis, as far as the line goes. Commas
// inside strings and brackets do not split arguments.
function splitArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (quote !== undefined) {
      current += char;
      if (char === "\\") {
        current += text[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      current += char;
    } else if (char === "(" || char === "[" || char === "{") {
      depth += 1;
      current += char;
    } else if (char === ")" || char === "]" || char === "}") {
      if (depth === 0) {
        args.push(current);
        return args;
      }
      depth -= 1;
      current += char;
    } else if (char === "," && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  args.push(current);
  return args;
}
