import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { splitArguments } from "./template-injection.js";

type Kind = "bcrypt" | "pbkdf2" | "scrypt";

// The least work each function should do. bcrypt's cost is a power of two; OWASP asks for at least
// 10. OWASP asks for 600,000 PBKDF2-SHA256 iterations; fewer than 100,000 is reported, which most
// code from before that advice uses. scrypt's N should be at least 2^14, the parameter the scrypt
// paper gives for interactive logins.
const minimum: Record<Kind, number> = { bcrypt: 10, pbkdf2: 100_000, scrypt: 16_384 };
const names: Record<Kind, string> = { bcrypt: "bcrypt cost", pbkdf2: "PBKDF2 iterations", scrypt: "scrypt N" };

// Where the work factor is: an argument of the call, or the value of a named option in it.
type Sink = { kind: Kind; files: RegExp; call: RegExp; argument?: number; option?: RegExp };

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
const sinks: Sink[] = [
  // bcrypt and bcryptjs.
  { kind: "bcrypt", files: javascript, call: /\bbcrypt\w*\.(?:hash|hashSync)\s*\(/g, argument: 1 },
  { kind: "bcrypt", files: javascript, call: /\bbcrypt\w*\.(?:genSalt|genSaltSync)\s*\(/g, argument: 0 },
  { kind: "pbkdf2", files: javascript, call: /\bpbkdf2(?:Sync)?\s*\(/g, argument: 2 },
  { kind: "scrypt", files: javascript, call: /\bscrypt(?:Sync)?\s*\(/g, option: /\b(?:N|cost)\s*:\s*/ },
  { kind: "pbkdf2", files: /\.py$/i, call: /\bpbkdf2_hmac\s*\(/g, argument: 3 },
  { kind: "pbkdf2", files: /\.py$/i, call: /\b(?:PBKDF2HMAC|pbkdf2_hmac)\s*\(/g, option: /\biterations\s*=\s*/ },
  { kind: "bcrypt", files: /\.py$/i, call: /\bbcrypt\.gensalt\s*\(/g, argument: 0 },
  { kind: "bcrypt", files: /\.py$/i, call: /\bbcrypt\.gensalt\s*\(/g, option: /\brounds\s*=\s*/ },
  { kind: "scrypt", files: /\.py$/i, call: /\b(?:hashlib\.scrypt|Scrypt)\s*\(/g, option: /\bn\s*=\s*/ },
  { kind: "pbkdf2", files: /\.(?:java|kt)$/i, call: /\bPBEKeySpec\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.(?:java|kt)$/i, call: /\b(?:BCrypt\.gensalt|BCryptPasswordEncoder)\s*\(/g, argument: 0 },
  { kind: "pbkdf2", files: /\.cs$/i, call: /\bRfc2898DeriveBytes(?:\.Pbkdf2)?\s*\(/g, argument: 2 },
  { kind: "pbkdf2", files: /\.cs$/i, call: /\bKeyDerivation\.Pbkdf2\s*\(/g, option: /\biterationCount\s*:\s*/ },
  { kind: "pbkdf2", files: /\.go$/i, call: /\bpbkdf2\.Key\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.go$/i, call: /\bbcrypt\.GenerateFromPassword\s*\(/g, argument: 1 },
  { kind: "scrypt", files: /\.go$/i, call: /\bscrypt\.Key\s*\(/g, argument: 2 },
  { kind: "bcrypt", files: /\.php$/i, call: /\bpassword_hash\s*\(/g, option: /["']cost["']\s*=>\s*/ },
  { kind: "pbkdf2", files: /\.php$/i, call: /\bhash_pbkdf2\s*\(/g, argument: 3 },
  { kind: "bcrypt", files: /\.rb$/i, call: /\bBCrypt::Password\.create\s*\(/g, option: /\bcost:\s*/ },
  { kind: "pbkdf2", files: /\.rb$/i, call: /\bpbkdf2_hmac(?:_sha1)?\s*\(/g, argument: 2 }
];

// Go's bcrypt.MinCost is 4.
const namedValues: Record<string, number> = { "bcrypt.MinCost": 4 };
// A name given a number in the patch, as in `const ITERATIONS = 1000`.
const numberAssignment = /^\s*(?:(?:export\s+)?(?:const|let|var|final|static|private|public|int|long)\s+)*(?:[\w<>]+\s+)?([A-Za-z_]\w*)\s*(?::\s*\w+\s*)?(?::=|=)\s*([\d_]+(?:\.\d+)?(?:e\d+)?)\s*[;,]?\s*$/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const weakPasswordHashingRule: Rule = {
  id: "weak-password-hashing",
  description: "Flags bcrypt, PBKDF2, and scrypt called with a work factor below current advice.",
  run({ files, config }) {
    if (!config.rules.weakPasswordHashing.enabled) {
      return [];
    }

    // Tests lower the cost on purpose, so they run fast.
    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSinks = sinks.filter((sink) => sink.files.test(file.path));
      if (
        fileSinks.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findWeakCalls(file.patch, fileSinks);
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const details = [...new Set(found.map((match) => `${names[match.kind]} ${match.value.toLocaleString("en-US")}, below ${minimum[match.kind].toLocaleString("en-US")}`))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "weak-password-hashing",
          title: "Password hashed with too little work",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "hash passwords or derive keys" : "hashes a password or derives a key"} with too little work (${details.join("; ")}), so a leaked hash can be guessed far faster on a GPU.`,
          recommendation:
            "Use a bcrypt cost of at least 10, at least 600,000 PBKDF2-SHA256 iterations, or scrypt with N of at least 2^14, or switch to Argon2id. Raise the cost again as hardware gets faster, and rehash passwords at the next login."
        }
      ];
    });
  }
};

function findWeakCalls(patch: string, fileSinks: Sink[]): Array<{ line: number; kind: Kind; value: number }> {
  const constants = new Map<string, number>(Object.entries(namedValues));
  const found: Array<{ line: number; kind: Kind; value: number }> = [];

  for (const { line, content, added } of patchLines(patch)) {
    if (content.length > maxLineLength || commentLine.test(content)) {
      continue;
    }
    const assigned = numberAssignment.exec(content);
    if (assigned?.[1] !== undefined) {
      constants.set(assigned[1], Number((assigned[2] ?? "").replace(/_/g, "")));
    }
    if (!added) {
      continue;
    }
    for (const sink of fileSinks) {
      for (const match of content.matchAll(sink.call)) {
        const rest = content.slice((match.index ?? 0) + match[0].length);
        const text = sink.argument !== undefined ? splitArguments(rest)[sink.argument] : optionValue(rest, sink.option);
        const value = numberOf(text ?? "", constants);
        if (value !== undefined && value < minimum[sink.kind]) {
          found.push({ line, kind: sink.kind, value });
        }
      }
    }
  }
  return found;
}

function optionValue(rest: string, option: RegExp | undefined): string | undefined {
  if (option === undefined) {
    return undefined;
  }
  const args = splitArguments(rest).join(",");
  const match = option.exec(args);
  return match === null ? undefined : args.slice(match.index + match[0].length).split(/[,)}\]]/)[0];
}

// A number written out, or a name given one: `1000`, `10_000`, `1e4`, `2 ** 10`, `1 << 10`, or
// `ITERATIONS`. Anything else, such as `rounds` from configuration or a ternary, is not read.
function numberOf(text: string, constants: Map<string, number>): number | undefined {
  const value = text.trim();
  const literal = /^([\d_]+(?:\.\d+)?(?:e\d+)?)$/i.exec(value);
  if (literal !== null) {
    return Number((literal[1] ?? "").replace(/_/g, ""));
  }
  const power = /^(\d+)\s*\*\*\s*(\d+)$/.exec(value);
  if (power !== null) {
    return Number(power[1]) ** Number(power[2]);
  }
  const shift = /^(\d+)\s*<<\s*(\d+)$/.exec(value);
  if (shift !== null) {
    return Number(shift[1]) * 2 ** Number(shift[2]);
  }
  return constants.get(value);
}
