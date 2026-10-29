import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "weak-hash" | "broken-cipher" | "ecb" | "weak-random";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  "weak-hash": "hashes a secret with MD5 or SHA-1",
  "broken-cipher": "encrypts with DES, 3DES, RC4, RC2, or Blowfish",
  ecb: "encrypts in ECB mode, which shows where the plaintext repeats",
  "weak-random": "makes a secret value with a random generator that is not meant for security"
};

// Words for something that must stay secret or unguessable, matched against the words of the
// line's names, so `footprint` is not an OTP and `tokens` in NLP code is not a credential.
const secretWords = new Set(["password", "passwd", "passphrase", "secret", "token", "nonce", "salt", "otp", "apikey", "csrf"]);
const secretPairs = [
  ["api", "key"],
  ["session", "id"],
  ["reset", "code"],
  ["verification", "code"]
];

const weakHash =
  /\bhashlib\.(?:md5|sha1)\s*\(|\bhashlib\.new\(\s*["'](?:md5|sha1)["']|\bcreateHash\(\s*["'](?:md5|sha1)["']|\bMessageDigest\.getInstance\(\s*"(?:MD5|SHA-?1)"|\b(?:md5|sha1)\s*\(\s*\$|\bDigest::(?:MD5|SHA1)\b|\b(?:MD5|SHA1)\.(?:Create|HashData)\(|\b(?:md5|sha1)\.(?:Sum|New)\(/;
const brokenCipher =
  /\bcreateCipher(?:iv)?\(\s*["'](?:des|des-ede3?|des3|rc4|rc2|bf|blowfish)(?:-[\w-]{1,20})?["']|\bCipher\.getInstance\(\s*"(?:DES|DESede|TripleDES|RC4|ARCFOUR|RC2|Blowfish)\b|\b(?:DES|DES3|ARC4|ARC2|Blowfish)\.new\(|\b(?:des\.New(?:TripleDES)?Cipher|rc4\.NewCipher)\(|\b(?:DES|TripleDES|RC2)\.Create\(/;
const ecbMode =
  /\bMODE_ECB\b|\/ECB\/|\bcreateCipher(?:iv)?\(\s*["'][\w-]{1,30}-ecb["']|\bCipher\.getInstance\(\s*"AES"\s*\)|\bCipherMode\.ECB\b|\bmodes\.ECB\(/;
const weakRandom = /\bMath\.random\(\)|\brandom\.(?:random|randint|randrange|choice|choices|sample|getrandbits)\(|\brand\(\)|\bmt_rand\(/;

const commentLine = /^\s*(?:#|\/\/|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const weakCryptoRule: Rule = {
  id: "weak-crypto",
  description: "Flags secrets hashed with MD5 or SHA-1, broken ciphers, ECB mode, and secrets made with non-cryptographic random numbers.",
  run({ files, config }) {
    if (!config.rules.weakCrypto.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = patchLines(file.patch).flatMap(({ line, content, added }) =>
        added && !commentLine.test(content) ? kindsIn(content).map((kind) => ({ line, kind })) : []
      );
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const lines = [...new Set(found.map((match) => match.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "weak-crypto",
          title: "Weak cryptography",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "use" : "uses"} cryptography that ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "Hash passwords with bcrypt, scrypt, or Argon2, encrypt with AES-GCM or ChaCha20-Poly1305, and make tokens with a cryptographic generator such as crypto.randomBytes, secrets.token_urlsafe, or SecureRandom."
        }
      ];
    });
  }
};

function kindsIn(content: string): Kind[] {
  const secret = mentionsSecret(content);
  return [
    ...(secret && weakHash.test(content) ? ["weak-hash" as const] : []),
    ...(brokenCipher.test(content) ? ["broken-cipher" as const] : []),
    ...(ecbMode.test(content) ? ["ecb" as const] : []),
    ...(secret && weakRandom.test(content) ? ["weak-random" as const] : [])
  ];
}

function mentionsSecret(content: string): boolean {
  const words = content
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  return (
    words.some((word) => secretWords.has(word)) ||
    secretPairs.some(([first, second]) => words.some((word, index) => word === first && words[index + 1] === second))
  );
}

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
