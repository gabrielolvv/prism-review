import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

// RSA, DSA, and Diffie-Hellman keys need 2048 bits; NIST stopped allowing shorter ones in 2013.
// 512- and 768-bit keys have been factored in public and are reported as high.
const minimumBits = 2048;
const brokenBits = 1024;

type KeyPattern = {
  files: RegExp;
  // The first group holds the size in bits, unless `bits` gives it.
  pattern: RegExp;
  algorithm: string;
  bits?: number;
  // Must appear within `contextWindow` lines of the match, such as the call that takes the option.
  // Its first group, when present, names the algorithm instead of `algorithm`.
  context?: RegExp;
  contextWindow?: number;
  // A line that matches this is not reported, such as `ssh-keygen -t ed25519 -b 256`.
  unless?: RegExp;
};

const js = /\.(?:[cm]?[jt]sx?)$/i;
const python = /\.py$/i;
const jvm = /\.(?:java|kt|groovy|scala)$/i;
// Shell scripts, Dockerfiles, CI workflows, and Makefiles that run openssl, ssh-keygen, or keytool.
const commands = /\.(?:sh|bash|zsh|ps1|ya?ml|mk)$|(?:^|\/)(?:Dockerfile[^/]*|[^/]*\.dockerfile|Makefile|Jenkinsfile[^/]*|Procfile)$/i;
// Elliptic curves of fewer than 224 bits.
const weakCurve = String.raw`(?:secp1(?:12|28|60|92)[rk][12]|prime192v[123]|sect1(?:13|31|63)[rk][12]|c2tnb191v[123]|P-?192|nistp192)`;

const keyPatterns: KeyPattern[] = [
  // Node.js crypto and WebCrypto, node-forge, node-rsa, selfsigned, and pem.
  { files: js, algorithm: "RSA", pattern: /\bmodulusLength\s*:\s*(\d+)/, context: /generateKeyPair|generateKey\b|\bRSA/, contextWindow: 6 },
  { files: js, algorithm: "RSA", pattern: /\bpki\.rsa\.generateKeyPair\s*\(\s*(?:\{[^}]*\bbits\s*:\s*)?(\d+)/ },
  { files: js, algorithm: "RSA", pattern: /\bnew\s+NodeRSA\s*\(\s*\{\s*b\s*:\s*(\d+)/ },
  { files: js, algorithm: "RSA", pattern: /\b(?:keySize|keyBitsize)\s*:\s*(\d+)/, context: /["'](?:selfsigned|pem|node-forge)["']/, contextWindow: Number.POSITIVE_INFINITY },
  { files: js, algorithm: "Diffie-Hellman", pattern: /\bcreateDiffieHellman\s*\(\s*(\d+)\s*[,)]/ },
  { files: js, algorithm: "Diffie-Hellman", pattern: /\bgetDiffieHellman\s*\(\s*["']modp1["']/, bits: 768 },
  { files: js, algorithm: "Diffie-Hellman", pattern: /\bgetDiffieHellman\s*\(\s*["']modp2["']/, bits: 1024 },
  // cryptography, PyCryptodome, and Paramiko.
  { files: python, algorithm: "RSA", pattern: /\bkey_size\s*=\s*(\d+)/, context: /\b(rsa|dsa|dh)\.generate_(?:private_key|parameters)\b/, contextWindow: 4 },
  { files: python, algorithm: "RSA", pattern: /\b(?:RSA|RSAKey|RSAPrivateKey)\.generate\s*\(\s*(?:(?:bits|key_size)\s*=\s*)?(\d+)/ },
  { files: python, algorithm: "DSA", pattern: /\b(?:DSA|DSSKey|DSAPrivateKey)\.generate\s*\(\s*(?:(?:bits|key_size)\s*=\s*)?(\d+)/ },
  // A curve used to make a key, not one listed among those a library accepts.
  {
    files: python,
    algorithm: "an elliptic curve",
    pattern: new RegExp(String.raw`\b(?:generate|derive)_private_key\s*\([^)]*?\bec\.(${weakCurve})\s*\(`, "i")
  },
  { files: python, algorithm: "an elliptic curve", pattern: new RegExp(String.raw`\bcurve\s*=\s*["'](?:NIST\s*)?(${weakCurve})["']`, "i") },
  // Go.
  { files: /\.go$/i, algorithm: "RSA", pattern: /\brsa\.Generate(?:MultiPrime)?Key\s*\(\s*[\w.()]+\s*,\s*(?:\d+\s*,\s*)?(\d+)\s*\)/ },
  { files: /\.go$/i, algorithm: "DSA", pattern: /\bdsa\.L1024N160\b/, bits: 1024 },
  // Java's KeyPairGenerator, RSAKeyGenParameterSpec, and ECGenParameterSpec.
  {
    files: jvm,
    algorithm: "RSA",
    pattern: /\.initialize\s*\(\s*(\d+)\s*[,)]/,
    context: /KeyPairGenerator\.getInstance\s*\(\s*["'](RSA|DSA|DH|DiffieHellman)["']/,
    contextWindow: 8
  },
  { files: jvm, algorithm: "RSA", pattern: /\bnew\s+RSAKeyGenParameterSpec\s*\(\s*(\d+)/ },
  { files: jvm, algorithm: "an elliptic curve", pattern: new RegExp(String.raw`\bnew\s+ECGenParameterSpec\s*\(\s*["'](${weakCurve})["']`, "i") },
  // .NET.
  { files: /\.cs$/i, algorithm: "RSA", pattern: /\bnew\s+(?:RSACryptoServiceProvider|RSACng|RSAOpenSsl)\s*\(\s*(\d+)\s*\)|\bRSA\.Create\s*\(\s*(\d+)\s*\)/ },
  { files: /\.cs$/i, algorithm: "DSA", pattern: /\bnew\s+(?:DSACryptoServiceProvider|DSACng|DSAOpenSsl)\s*\(\s*(\d+)\s*\)|\bDSA\.Create\s*\(\s*(\d+)\s*\)/ },
  // `KeySize` on an object named for RSA or DSA, not on an AES or HMAC one.
  { files: /\.cs$/i, algorithm: "RSA", pattern: /\b\w*[Rr][Ss][Aa]\w*\.KeySize\s*=\s*(\d+)\b/ },
  { files: /\.cs$/i, algorithm: "DSA", pattern: /\b\w*[Dd][Ss][Aa]\w*\.KeySize\s*=\s*(\d+)\b/ },
  // Ruby's and PHP's OpenSSL bindings.
  { files: /\.rb$/i, algorithm: "RSA", pattern: /\bOpenSSL::PKey::RSA\.(?:new|generate)\s*\(?\s*(\d+)/ },
  { files: /\.rb$/i, algorithm: "DSA", pattern: /\bOpenSSL::PKey::DSA\.(?:new|generate)\s*\(?\s*(\d+)/ },
  { files: /\.php$/i, algorithm: "RSA", pattern: /["']private_key_bits["']\s*=>\s*(\d+)/ },
  // openssl, ssh-keygen, and keytool commands. Their sizes come last or after a flag.
  { files: commands, algorithm: "RSA", pattern: /\bopenssl\s+genrsa\b[^|;&\n#]*?\s(\d{3,5})(?=\s*(?:$|[;&|)"'\\]))/ },
  { files: commands, algorithm: "RSA", pattern: /-newkey\s+rsa:(\d+)\b|\brsa_keygen_bits:(\d+)\b/ },
  { files: commands, algorithm: "DSA", pattern: /\bopenssl\s+(?:gendsa|dsaparam)\b[^|;&\n#]*?\s(\d{3,5})(?=\s*(?:$|[;&|)"'\\]))/ },
  { files: commands, algorithm: "Diffie-Hellman", pattern: /\bopenssl\s+dhparam\b[^|;&\n#]*?\s(\d{3,5})(?=\s*(?:$|[;&|)"'\\]))/ },
  { files: commands, algorithm: "RSA", pattern: /\bssh-keygen\b[^|;&\n#]*?\s-b\s*(\d+)/, unless: /\s-t\s*["']?(?:ecdsa|ed25519|ecdsa-sk|ed25519-sk)\b/ },
  { files: commands, algorithm: "DSA", pattern: /\bssh-keygen\b[^|;&\n#]*?\s-t\s*["']?dsa\b/, bits: 1024 },
  { files: commands, algorithm: "RSA", pattern: /\bkeytool\b[^|;&\n#]*?\s-keysize\s+(\d+)/, unless: /\s-keyalg\s+["']?EC\b/i },
  // Terraform's tls_private_key, and cert-manager's Certificate.
  { files: /\.tf$/i, algorithm: "RSA", pattern: /\brsa_bits\s*=\s*(\d+)/ },
  { files: /\.ya?ml$/i, algorithm: "RSA", pattern: /^\s*size\s*:\s*(\d+)\s*$/, context: /^\s*algorithm\s*:\s*["']?(RSA)\b/, contextWindow: 3 }
];

const algorithmNames: Record<string, string> = { rsa: "RSA", dsa: "DSA", dh: "Diffie-Hellman", diffiehellman: "Diffie-Hellman" };

// Test helper packages, such as Go's `acmetest` and `testutil`, make throwaway keys for speed.
const testHelperPath = /(?:^|\/)(?!latest\/|contest\/)(?:[a-z]+test|testutils?|testing|testhelpers?)\//i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|REM\b|::)/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const weakKeySizeRule: Rule = {
  id: "weak-key-size",
  description: "Flags RSA, DSA, and Diffie-Hellman keys shorter than 2048 bits, and elliptic curves shorter than 224 bits.",
  run({ files, config }) {
    if (!config.rules.weakKeySize.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const patterns = keyPatterns.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        patterns.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test setups make throwaway keys.
        developmentPath.test(file.path) ||
        testHelperPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; label: string; broken: boolean }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        for (const key of patterns) {
          const match = key.pattern.exec(content);
          if (match === null || key.unless?.test(content) === true) {
            continue;
          }
          let algorithm = key.algorithm;
          if (key.context !== undefined) {
            const window = key.contextWindow ?? 0;
            const nearby = lines.slice(Math.max(0, index - window), Math.min(lines.length, index + window + 1));
            const context = nearby.map(({ content: other }) => key.context?.exec(other)).find((result) => result != null);
            if (context == null) {
              continue;
            }
            algorithm = algorithmNames[context[1]?.toLowerCase() ?? ""] ?? algorithm;
          }
          const value = match.slice(1).find((group) => group !== undefined);
          if (algorithm === "an elliptic curve") {
            found.push({ line, label: `the ${value ?? "weak"} curve`, broken: false });
            break;
          }
          const bits = key.bits ?? Number(value);
          if (!Number.isFinite(bits) || bits <= 0 || bits >= minimumBits) {
            continue;
          }
          found.push({ line, label: `${bits}-bit ${algorithm}`, broken: bits < brokenBits });
          break;
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "weak-key-size",
          title: "Key too short",
          severity: found.some(({ broken }) => broken) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "make keys" : "makes a key"} too short to resist current attacks (${listOf(labels)}). Anyone who breaks the key can forge what it signs and read what it encrypts, and 512- and 768-bit keys have been broken in public for little money.`,
          recommendation:
            "Use 3072-bit RSA keys, or at least 2048 bits, and prefer elliptic curves such as P-256 or Ed25519, which are shorter and faster. Replace DSA, which OpenSSH and most libraries have dropped, and use Diffie-Hellman groups of at least 2048 bits or X25519."
        }
      ];
    });
  }
};
