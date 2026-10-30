import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// A password field read from a stored record: `user.password`, `row["password"]`, `$user->password`,
// `user.getPassword()`, `account.Password`, or `this.password` in a model's own method.
const storedPassword =
  /(?<![\w$])\$?(?!(?:req|request|body|form|params|args|data|input|values|ctx|query|payload|dto|credentials|creds|login|cmd|command|model|vm|viewModel|e|event|_POST|_GET|_REQUEST|_COOKIE)\b)([A-Za-z_][\w$]*)(?:\??\.|->|\[\s*["']|\.get\s*\(\s*["']|\.get)(?:password|passwd|pwd|pass|user_password|userPassword|Password|PASSWORD|Passwd)\b(?:["']\s*\]|["']\s*\)|\s*\(\s*\))?/;
// The password the user typed: from the request, or a parameter or variable named for it.
const typedPassword =
  /\b(?:req|request|ctx(?:\.request)?)\.(?:body|query|form|args|values|json|POST|GET|data)\b[^,;)]*(?:password|passwd|pwd|pass)|\$_(?:POST|GET|REQUEST)\s*\[\s*["'](?:password|passwd|pwd|pass)\w*["']|\bgetParameter\s*\(\s*"(?:password|passwd|pwd|pass)\w*"|\bparams\s*\[\s*:(?:password|passwd|pwd|pass)\w*\s*\]|(?<![\w$.>])\$?(?:password|passwd|pwd|pass|plain(?:_|text)?password|plainPassword|rawPassword|raw_password|input_?password|inputPassword|given_?password|givenPassword|candidate(?:_?password|Password)?|entered_?password|enteredPassword|submitted_?password|submittedPassword|provided_?password|providedPassword|user_?password|userPassword)\b(?!\s*(?:\.|\[|->|\())/i;
// Words that make a field something other than the password itself.
const notThePassword = /hash|digest|crypt|salt|confirm|repeat|retype|again|verify|old|new|reset|policy|length|len\b|min|max|regex|pattern|strength|expir|changed|required|field|label|hint|placeholder/i;
// Hashing and verification on the same line.
const hashed =
  /\b(?:bcrypt|bcryptjs|argon2|scrypt|pbkdf2|hash\w*|verify\w*|compare\w*|check_password|checkpw|password_verify|matches|digest|crypt|encode|hmac|sha\d*|md5|timingSafeEqual|compare_digest|secure_compare|authenticate|SignInManager|PasswordHasher|passlib)\b/i;

// `==`, `===`, `!=`, `!==`, and `equals`, with the two sides they compare.
const equality = /(?<![=!<>])(?:===|!==|==|!=)(?!=)/g;
const chainBefore = /(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\s*$/;
const chainAfter = /^\s*(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)/;
const equalsCall = /(\$?[\w$]+(?:\??\.[\w$]+|->[\w$]+|\([^()]*\)|\[[^[\]]*\])*)\.(?:equals|Equals)\s*\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const twoArgumentEquals = /\b(?:Objects\.equals|String\.Equals|strcmp|hash_equals)\s*\(\s*([^,()]+(?:\([^()]*\))?)\s*,\s*([^,()]+(?:\([^()]*\))?)\s*[,)]/g;

const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|go|java|kt|scala|cs|php)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const maxLineLength = 1_000;

export const plaintextPasswordRule: Rule = {
  id: "plaintext-password",
  description: "Flags passwords compared with the stored password directly, which means passwords are stored in plain text.",
  run({ files, config }) {
    if (!config.rules.plaintextPassword.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !sourceFile.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch).flatMap(({ line, content, added }) =>
        added && content.length <= maxLineLength && !commentLine.test(content) && !hashed.test(content) && comparesPlaintext(content)
          ? [line]
          : []
      );
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "plaintext-password",
          title: "Password compared in plain text",
          severity: "high" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "compare" : "compares"} the password a user typed with the stored password directly, which means passwords are stored as they were typed: anyone who reads the database, a backup, or a log of it has every user's password.`,
          recommendation:
            "Store only a slow, salted hash of each password, made with bcrypt, scrypt, Argon2, or PBKDF2, such as `bcrypt.hash` and `bcrypt.compare`, Django's `make_password` and `check_password`, `password_hash` and `password_verify` in PHP, Spring's `PasswordEncoder`, or ASP.NET's `PasswordHasher`, and migrate the passwords already stored."
        }
      ];
    });
  }
};

// The last name in a chain, as in `password` in `admin.password` or `row["password"]`.
function fieldOf(chain: string): string {
  return chain.replace(/^.*(?:\.|->|\[\s*["':]|\.get\s*\(\s*["'])/s, "");
}

function comparesPlaintext(content: string): boolean {
  const pairs: Array<[string, string]> = [];
  for (const match of content.matchAll(equality)) {
    const left = chainBefore.exec(content.slice(0, match.index))?.[1];
    const right = chainAfter.exec(content.slice(match.index + match[0].length))?.[1];
    if (left !== undefined && right !== undefined) {
      pairs.push([left, right]);
    }
  }
  for (const match of content.matchAll(equalsCall)) {
    pairs.push([match[1] ?? "", match[2] ?? ""]);
  }
  for (const match of content.matchAll(twoArgumentEquals)) {
    pairs.push([match[1] ?? "", match[2] ?? ""]);
  }
  return pairs.some(([left, right]) => isPair(left.trim(), right.trim()) || isPair(right.trim(), left.trim()));
}

// One side is a stored password field and the other the password the user typed.
function isPair(stored: string, typed: string): boolean {
  // Only the field's own name says what it holds: `admin.password` is a password, `user.passwordMin` is not.
  if (notThePassword.test(fieldOf(stored)) || notThePassword.test(fieldOf(typed))) {
    return false;
  }
  return storedPassword.test(stored) && typedPassword.test(typed) && !storedPassword.test(typed.replace(/^\$?this\b/, "x"));
}
