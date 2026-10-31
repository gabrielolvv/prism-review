import { patchLines } from "../analysis/added-lines.js";

// Settings that hold the key a framework signs session cookies with, written as one assignment or
// call per line. The value is the text after the match.
const assignments: Array<{ files: RegExp; setting: RegExp }> = [
  // Flask and Django.
  {
    files: /\.py$/i,
    setting: /^\s*(?:(?:app|application)\.secret_key\s*=|(?:app|application)\.config\s*\[\s*["']SECRET_KEY["']\s*\]\s*=|SECRET_KEY\s*=|.*\bSECRET_KEY\s*=(?!=))\s*/
  },
  // Rails, Sinatra, and Rack.
  {
    files: /\.(?:rb|ru)$/i,
    setting: /\b(?:config\.secret_key_base|config\.secret_token|secret_key_base:|set\s+:session_secret,|Rack::Session::Cookie,.*\bsecret:)\s*=?\s*/
  },
  // Rails' config/secrets.yml and Phoenix's config/*.exs.
  { files: /\.(?:ya?ml|exs?)$/i, setting: /^\s*secret_key_base\s*:\s*/ },
  // Koa's `app.keys = ["..."]` and cookie-parser's `cookieParser("...")`.
  { files: /\.(?:[cm]?[jt]sx?)$/i, setting: /\bapp\.keys\s*=\s*\[\s*|\bcookieParser\s*\(\s*\[?\s*/ },
  // gorilla/sessions, gin-contrib/sessions, and securecookie.
  { files: /\.go$/i, setting: /\b(?:sessions\.NewCookieStore|cookie\.NewStore|securecookie\.New|sessions\.NewFilesystemStore\s*\([^,]*,)\s*\(\s*\[\]byte\s*\(\s*/ }
];

// Session middleware whose options object holds the key, as in `session({ secret: "..." })`. The
// options can span lines, so the key is looked for until the call closes.
const sessionCall =
  /\b(?:session|expressSession|cookieSession|koaSession|fastifySession|fastifySecureSession|ironSession|getIronSession|withIronSessionApiRoute|sealData)\s*\(|\bregister\s*\(\s*(?:fastifyCookie|fastifySession|fastifySecureSession|require\(\s*["']@fastify\/(?:cookie|session|secure-session)["']\s*\))|\b(?:sessionOptions|ironOptions)\s*(?::\s*\w+\s*)?=\s*\{/;
const optionKey = /\b(?:secret|keys|password)\s*:\s*\[?\s*/;
// How far, in lines, an options object is read.
const optionsReach = 15;

// Text written in the code. Template placeholders, such as Django's project template, and
// interpolated strings are left out, and so are empty strings, which make the framework refuse to
// start.
const literal = /^(?:[bBrRuU]{1,2})?(["'`])((?:\\.|(?!\1).)+)\1/;
const placeholder = /\{\{|\{%|<%|\$\{|^\s*$/;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const maxLineLength = 1_000;

// The added lines, numbered as in the new file, that set a session or cookie signing key to text
// written in the code. It runs before redaction, which rewrites `secret: "..."` and
// `SECRET_KEY = "..."` because of their names.
export function findSessionSecretLines(path: string, patch: string): number[] {
  const fileAssignments = assignments.filter(({ files }) => files.test(path));
  const javascript = /\.(?:[cm]?[jt]sx?)$/i.test(path);
  if (fileAssignments.length === 0) {
    return [];
  }
  const python = /\.py$/i.test(path);
  const found: number[] = [];
  // Lines left to read in an open options object, and whether a Python docstring is open, as in
  // Flask's documentation of `SECRET_KEY = 'development key'`.
  let optionsLeft = 0;
  let depth = 0;
  let inDocstring = false;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      optionsLeft = 0;
      inDocstring = false;
    }
    const wasInDocstring = inDocstring;
    if (python && ((content.match(/"""|'''/g) ?? []).length % 2 === 1)) {
      inDocstring = !inDocstring;
    }
    if (content.length > maxLineLength || commentLine.test(content) || wasInDocstring) {
      continue;
    }
    const call = javascript ? sessionCall.exec(content) : null;
    if (call !== null) {
      optionsLeft = optionsReach;
      depth = 0;
    }
    const assigned = fileAssignments.some(({ setting }) => {
      const match = setting.exec(content);
      return match !== null && !insideString(content, match.index) && isLiteral(content.slice(match.index + match[0].length));
    });
    const inOptions =
      optionsLeft > 0 &&
      (() => {
        const match = optionKey.exec(content);
        return match !== null && isLiteral(content.slice(match.index + match[0].length));
      })();
    if (added && (assigned || inOptions)) {
      found.push(line);
    }
    if (optionsLeft > 0) {
      // The options close when their braces balance, past nested objects such as `cookie: { ... }`.
      const text = call === null ? content : content.slice(call.index);
      const opened = depth > 0 || text.includes("{");
      depth += (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length;
      optionsLeft = opened && depth <= 0 ? 0 : optionsLeft - 1;
    }
  }
  return found;
}

// Whether a position is inside quoted text, as `cookieParser("secret")` is in an error message.
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

function isLiteral(value: string): boolean {
  const match = literal.exec(value.trim());
  return match !== null && !placeholder.test(match[2] ?? "");
}
