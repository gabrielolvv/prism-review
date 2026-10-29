import { patchLines } from "../analysis/added-lines.js";

// Calls that write to a log or the console, in JavaScript, Python, Ruby, Go, Java, Kotlin, C#, and
// PHP. The match ends at the call's opening parenthesis, or at the space before Ruby's arguments.
const logCall = new RegExp(
  [
    String.raw`\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(`,
    String.raw`\b(?:logger|log|_logger|LOGGER|LOG|logging|Logger|Log|winston|pino|bunyan|signale|self\.logger|self\.log|this\.logger|this\.log|Rails\.logger|app\.logger|current_app\.logger)\.(?:log|info|warn|warning|error|debug|trace|fatal|critical|exception|verbose|notice|Debug|Info|Warn|Error|Fatal|Print|Printf|Println|Debugf|Infof|Warnf|Errorf|Fatalf|LogInformation|LogDebug|LogWarning|LogError|LogTrace|LogCritical)\s*[(\s]`,
    String.raw`\blog\.(?:Print|Printf|Println|Fatal|Fatalf|Fatalln|Panic|Panicf)\s*\(`,
    String.raw`\bSystem\.(?:out|err)\.print(?:ln|f)?\s*\(`,
    String.raw`\bConsole\.(?:Write|WriteLine)\s*\(`,
    String.raw`\berror_log\s*\(|\bLog::(?:debug|info|notice|warning|error|critical|alert|emergency)\s*\(`
  ].join("|")
);

// Words for something secret, matched against the words of names outside quoted text, so `tokens`
// in a tokenizer, `footprint`, and the text "Invalid password" do not count.
const secretWords = new Set(["password", "passwd", "passphrase", "secret", "token", "apikey", "credential", "credentials", "authorization", "privatekey", "cvv"]);
const secretPairs = [
  ["api", "key"],
  ["private", "key"],
  ["access", "key"],
  ["client", "secret"],
  ["card", "number"],
  ["session", "id"]
];
// Names about a secret rather than the secret itself, such as `passwordLength`, `tokenType`,
// `hasToken`, or `secretName`.
const describingWords = new Set([
  "length",
  "len",
  "size",
  "count",
  "type",
  "types",
  "name",
  "names",
  "field",
  "fields",
  "label",
  "hint",
  "policy",
  "expiry",
  "expires",
  "expiration",
  "ttl",
  "url",
  "uri",
  "path",
  "file",
  "filename",
  "header",
  "masked",
  "redacted",
  "hash",
  "hashed",
  "digest",
  "fingerprint",
  "valid",
  "invalid",
  "required",
  "strength",
  "changed",
  "set",
  "exists",
  "present",
  "missing",
  "is",
  "has",
  "should",
  "error",
  "errors",
  "message",
  "prefix",
  "suffix",
  "last4",
  "id",
  // What a token says about its holder, as in Spring's `token.getPrincipal()`.
  "principal",
  "subject",
  "issuer",
  "audience",
  "scope",
  "scopes",
  "claims"
]);

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const sourceFile = /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|java|kt|scala|cs|php)$/i;
const maxLineLength = 1_000;

// The added lines, numbered as in the new file, where a log or console call writes a value named like
// a secret. It runs before redaction, which rewrites text such as f"token={token}" because of the
// word before the equals sign.
export function findSecretLogLines(path: string, patch: string): number[] {
  // TypeScript declaration files describe types and run nothing.
  if (!sourceFile.test(path) || /\.d\.[cm]?ts$/i.test(path)) {
    return [];
  }
  return patchLines(patch).flatMap(({ line, content, added }) =>
    added && !commentLine.test(content) && content.length <= maxLineLength && logsSecret(content) ? [line] : []
  );
}

function logsSecret(content: string): boolean {
  const call = logCall.exec(content);
  if (call === null) {
    return false;
  }
  // Each chain of names, such as `user.password` or `password.length`, counts once: it is a secret
  // when a name in it is, and no name after that one describes or masks the value.
  return codeOutsideText(content.slice(call.index + call[0].length))
    .split(/[^A-Za-z0-9_$.]+/)
    .map((chain) => chain.split(".").filter(Boolean))
    .some((names) => {
      const secret = names.findIndex(isSecretName);
      return secret !== -1 && !names.slice(secret + 1).some((name) => describes(name) || maskingCall.test(name));
    });
}

// Methods that shorten or hide a value before it is logged, such as `token.slice(-4)`.
const maskingCall = /^(?:slice|substring|substr|mask|redact|hash|digest|toMasked|last4)$/i;

function describes(name: string): boolean {
  return wordsOf(name).some((word) => describingWords.has(word));
}

// The code of the arguments, with the text of string literals removed but the values they insert
// kept, as in `${token}`, f"{token}", or "#{token}".
function codeOutsideText(text: string): string {
  return text.replace(/([fF]?)(["'`])((?:\\.|(?!\2)[^\\])*)\2/g, (_literal, prefix: string, quote: string, body: string) => {
    const inserted = [
      ...body.matchAll(quote === "`" ? /\$\{([^}]*)\}/g : prefix !== "" ? /\{([^}]*)\}/g : /#\{([^}]*)\}/g)
    ].map((match) => match[1] ?? "");
    return ` ${inserted.join(" ")} `;
  });
}

function wordsOf(name: string): string[] {
  return name
    .split(/_|\$/)
    .flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function isSecretName(name: string): boolean {
  const words = wordsOf(name);
  if (words.some((word) => describingWords.has(word))) {
    return false;
  }
  return (
    words.some((word) => secretWords.has(word)) ||
    secretPairs.some(([first, second]) => words.some((word, index) => word === first && words[index + 1] === second))
  );
}
