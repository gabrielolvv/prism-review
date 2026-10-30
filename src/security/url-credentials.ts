import { addedLines } from "../analysis/added-lines.js";
import { credentialFileKind, isPlaceholder, localHost } from "./credential-files.js";
import { isAllowlisted } from "./credential-formats.js";

// A URL with a password in it, such as `postgres://app:hunter2@db.internal/app` or
// `redis://:hunter2@cache.internal:6379`. Quotes and whitespace end each part, so a URL inside a
// string stops at the closing quote. Group 1 is the user name, 2 the password, and 3 the host.
const urlWithPassword = /\b[a-z][\w+.-]*:\/\/([^\s:@/'"`]*):([^\s@/'"`]+)@(\[[^\]\s]*\]|[^\s:/?#'"`]+)/gi;
// Template syntax fills in the password from somewhere else: `${DB_PASSWORD}`, `{{ .Values.password }}`,
// `{password}`, `<password>`, `%s`, `%(password)s`, `$PASSWORD`, and Rails' `#{password}`.
const template = /[${}<>]|%(?:s|\(|\{)|^\*/;
// Values that documentation and examples use, beyond those the credential-file rule already skips.
const examplePassword =
  /^(?:pass(?:word)?\d*|passw0rd|pwd|passwd|secret\d*|mysecretpassword|s3cr3t|p@ss(?:word)?|pa\$\$word|foo|bar|baz|qux|user|username|letmein|tiger\S*|a secret|redacted|hidden|masked|xxx+|\*+|\.{3}|…)$/i;
// Hosts that only name a place in the docs: example.com, *.example, *.test, *.invalid, and words
// such as `host` or `hostname`.
const exampleHost = /(?:^|\.)(?:example\.(?:com|org|net)|example|test|invalid|localhost)$|^(?:host|hostname|server|domain|your[\w-]*|my[\w-]*host|db-host|server-name)$/i;

// Oracle's scott/tiger and other demo passwords are skipped above; one to three characters, as in
// `u:p@dsn`, only stand for a password in an example.
const minPasswordLength = 4;
// Comments explain URLs, such as `// postgres://u:sec:ret@h`, rather than use them.
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--|;)/;

// Only lines this long are scanned, since this runs on patches before the size limit.
const maxLineLength = 2_000;

// The added lines, numbered as in the new file, that hold a URL with a real-looking password. It
// runs before redaction, which hides the password. Environment and package manager files are left
// to the credential-file rule, which reports their URLs too.
export function findUrlCredentialLines(path: string, patch: string, allowlist: RegExp[] = []): number[] {
  if (credentialFileKind(path) !== undefined) {
    return [];
  }
  return addedLines(patch)
    .filter(({ content }) => content.length <= maxLineLength && content.includes("://") && !commentLine.test(content) && hasUrlPassword(content, allowlist))
    .map(({ line }) => line);
}

// Replaces the passwords that findUrlCredentialLines would report, keeping the rest of the URL.
export function redactUrlPasswords(text: string, redaction: string, allowed: (value: string) => boolean): string {
  if (!text.includes("://")) {
    return text;
  }
  return text.replace(urlWithPassword, (match, user: string, password: string, host: string) => {
    if (isExample(user, password, host) || allowed(password)) {
      return match;
    }
    const start = match.indexOf("://") + 3 + user.length + 1;
    return `${match.slice(0, start)}${redaction}${match.slice(start + password.length)}`;
  });
}

export function hasUrlPassword(content: string, allowlist: RegExp[] = []): boolean {
  for (const [, user = "", password = "", host = ""] of content.matchAll(urlWithPassword)) {
    if (!isExample(user, password, host) && !isAllowlisted(password, allowlist)) {
      return true;
    }
  }
  return false;
}

function isExample(user: string, password: string, host: string): boolean {
  const decoded = safeDecode(password);
  return (
    template.test(password) ||
    decoded.length < minPasswordLength ||
    isPlaceholder(decoded) ||
    examplePassword.test(decoded) ||
    decoded === user ||
    localHost.test(host) ||
    exampleHost.test(host)
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
