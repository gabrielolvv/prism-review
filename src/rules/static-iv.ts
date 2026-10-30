import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Calls that take an IV or nonce, and which argument holds it. `key` reads a keyword or property,
// such as Python's `iv=` or WebCrypto's `iv:`; `assigned` reads the right side of `.IV = ...`.
type Sink = { files: RegExp; call: RegExp; argument: number | "assigned" };

const sinks: Sink[] = [
  // Node.js crypto.
  { files: /\.(?:[cm]?[jt]sx?)$/i, call: /\bcreate(?:Cipher|Decipher)iv\s*\(/g, argument: 2 },
  // pyca/cryptography modes and PyCryptodome.
  { files: /\.py$/i, call: /\bmodes\.(?:CBC|GCM|CTR|CFB|CFB8|OFB|XTS)\s*\(/g, argument: 0 },
  { files: /\.py$/i, call: /\b(?:AES|DES3|ChaCha20|ChaCha20_Poly1305|Salsa20)\.new\s*\(/g, argument: 2 },
  // Java's javax.crypto.
  { files: /\.(?:java|kt|scala)$/i, call: /\bnew\s+IvParameterSpec\s*\(/g, argument: 0 },
  { files: /\.(?:java|kt|scala)$/i, call: /\bnew\s+GCMParameterSpec\s*\(/g, argument: 1 },
  // Go's crypto/cipher, and an AEAD's Seal and Open.
  { files: /\.go$/i, call: /\bcipher\.New(?:CBC(?:En|De)crypter|CTR|CFB(?:En|De)crypter|OFB)\s*\(/g, argument: 1 },
  { files: /\.go$/i, call: /\b(?:gcm|aead|aesgcm|aesGCM|chacha|ccm)\.(?:Seal|Open)\s*\(/gi, argument: 1 },
  // .NET.
  { files: /\.cs$/i, call: /\.IV\s*=(?!=)/g, argument: "assigned" },
  { files: /\.cs$/i, call: /\.Create(?:En|De)cryptor\s*\(/g, argument: 1 },
  // PHP's OpenSSL and libsodium.
  { files: /\.php$/i, call: /\bopenssl_(?:en|de)crypt\s*\(/g, argument: 4 },
  { files: /\.php$/i, call: /\bsodium_crypto_secretbox(?:_open)?\s*\(/g, argument: 1 },
  // Ruby's OpenSSL::Cipher.
  { files: /\.rb$/i, call: /\.iv\s*=(?!=)/g, argument: "assigned" }
];
// Keyword and property forms: Python's `iv=` and `nonce=`, and WebCrypto's `{ name: "AES-GCM", iv }`.
const keyedIv = /(?:^|[,({\s])(?:iv|nonce|initialization_vector)\s*[=:](?!=)\s*/g;
// The shorthand property `{ name: "AES-GCM", iv }`, whose value is the name itself.
const shorthandIv = /[{,]\s*(iv|nonce)\s*(?=[,}])/g;
const keyedFiles = /\.(?:py|[cm]?[jt]sx?)$/i;
const keyedContext = /\bsubtle\.(?:en|de)crypt\s*\(|\bAES-(?:GCM|CBC|CTR)\b|\.new\s*\(|\bCipher\s*\(|\bmodes\./;

// A value the same every time: text, a byte literal, a zeroed buffer, or a list of numbers.
const fixedValue = new RegExp(
  [
    String.raw`^[bBrRuU]{0,2}["'\`]`,
    String.raw`^"[^"]*"\s*\.\s*(?:getBytes|encode|toByteArray)\s*\(`,
    String.raw`^Buffer\.(?:from\s*\(\s*["'\`[]|alloc\s*\(\s*\d+\s*\))`,
    String.raw`^new\s+(?:Uint8Array|Buffer)\s*\(\s*(?:\d+|\[)`,
    String.raw`^new\s+byte\s*\[\s*\w*\s*\](?:\s*\{)?`,
    String.raw`^byteArrayOf\s*\(|^ByteArray\s*\(\s*\d+\s*\)`,
    String.raw`^make\s*\(\s*\[\]byte\s*,`,
    String.raw`^\[\]byte\s*(?:\(\s*"|\{)`,
    String.raw`^(?:Encoding\.\w+|System\.Text\.Encoding\.\w+)\.GetBytes\s*\(\s*"`,
    String.raw`^bytes\s*\(\s*(?:\d+|\[)`,
    String.raw`^bytearray\s*\(\s*\d+\s*\)`,
    String.raw`^b?["']\\x00["']\s*\*`,
    String.raw`^str_repeat\s*\(`,
    String.raw`^\[\s*(?:0x)?\d`,
    String.raw`^\{\s*(?:\(byte\)\s*)?(?:0x)?\d`
  ].join("|")
);
// Filling a buffer with random bytes, which makes a zeroed buffer a real IV.
const randomFill =
  /\b(?:randomFill(?:Sync)?|getRandomValues|ReadFull|rand\.Read|nextBytes|RAND_bytes|urandom|token_bytes|get_random_bytes|random_bytes|openssl_random_pseudo_bytes|randombytes_buf|random_iv|RandomNumberGenerator|GenerateIV|randomBytes|SecureRandom|generateIv|random_key)\b/;

const assignment = /^\s*(?:(?:const|let|var|final|private|public|protected|static|readonly|val|byte\[\]|\[\]byte|var)\s+)*(?:byte\s*\[\]\s+)?\$?([A-Za-z_][\w]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)\s*(.*?);?\s*$/;
const reach = 60;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const staticIvRule: Rule = {
  id: "static-iv",
  description: "Flags encryption with an IV or nonce that is the same every time.",
  run({ files, config }) {
    if (!config.rules.staticIv.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSinks = sinks.filter((sink) => sink.files.test(file.path));
      const keyed = keyedFiles.test(file.path);
      if (
        (fileSinks.length === 0 && !keyed) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = findStaticIvs(patchLines(file.patch), fileSinks, keyed);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "static-iv",
          title: "Encryption with a fixed IV or nonce",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "encrypt" : "encrypts"} with an IV or nonce that is the same every time. With CBC, this shows which messages start the same; with GCM or ChaCha20, reusing a nonce with the same key reveals the plaintexts and lets messages be forged.`,
          recommendation:
            "Make a new random IV or nonce for every message, such as `crypto.randomBytes(12)`, `os.urandom(12)`, `SecureRandom.nextBytes`, or `io.ReadFull(rand.Reader, nonce)`, and store it next to the ciphertext. It does not need to be secret."
        }
      ];
    });
  }
};

function findStaticIvs(lines: PatchLine[], fileSinks: Sink[], keyed: boolean): number[] {
  const found: number[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength || commentLine.test(content) || randomFill.test(content)) {
      return;
    }
    const ivs: string[] = [];
    for (const sink of fileSinks) {
      sink.call.lastIndex = 0;
      for (const match of content.matchAll(sink.call)) {
        const rest = content.slice(match.index + match[0].length);
        const value = sink.argument === "assigned" ? rest.replace(/;\s*$/, "") : splitArguments(rest)[sink.argument];
        if (value !== undefined) {
          ivs.push(value.replace(/^\s*(?:iv|nonce|IV)\s*[=:]\s*/, ""));
        }
      }
    }
    if (keyed && keyedContext.test(content)) {
      keyedIv.lastIndex = 0;
      for (const match of content.matchAll(keyedIv)) {
        ivs.push(splitArguments(content.slice(match.index + match[0].length))[0] ?? "");
      }
      shorthandIv.lastIndex = 0;
      for (const match of content.matchAll(shorthandIv)) {
        ivs.push(match[1] ?? "");
      }
    }
    if (ivs.some((iv) => isFixed(iv.trim(), lines, index))) {
      found.push(line);
    }
  });
  return found;
}

// A fixed value, or a name assigned one in the lines before that is never filled with random bytes.
function isFixed(iv: string, lines: PatchLine[], index: number): boolean {
  if (iv === "" || randomFill.test(iv)) {
    return false;
  }
  if (fixedValue.test(iv)) {
    return true;
  }
  const name = /^\$?([A-Za-z_][\w]*)\s*$/.exec(iv)?.[1];
  const current = lines[index];
  if (name === undefined || current === undefined) {
    return false;
  }
  const uses = new RegExp(`(?<![\\w$.])\\$?${name}(?![\\w$])`);
  for (let at = index - 1; at >= 0; at -= 1) {
    const earlier = lines[at];
    if (earlier === undefined || current.line - earlier.line > reach) {
      return false;
    }
    if (randomFill.test(earlier.content) && uses.test(earlier.content)) {
      return false;
    }
    const assigned = assignment.exec(earlier.content);
    if (assigned?.[1] === name) {
      return fixedValue.test((assigned[2] ?? "").trim()) && !randomFill.test(assigned[2] ?? "");
    }
  }
  return false;
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
  args.push(current);
  return args;
}
