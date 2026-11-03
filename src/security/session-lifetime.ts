import { patchLines } from "../analysis/added-lines.js";

// Sessions and access tokens that last longer than this: a stolen one keeps working for that long,
// and a JWT cannot be revoked before it expires.
export const maxLifetimeSeconds = 30 * 24 * 60 * 60;

const second = 1;
const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;
const year = 365 * day;

// A duration as the `ms` package and jose write it: "365d", "1y", "52w", or "8760h".
const durationText = /^["'`]\s*(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|yrs?|years?)\s*["'`]$/i;
const textUnits: Array<[RegExp, number]> = [
  [/^(?:ms|milliseconds?)$/i, 0.001],
  [/^(?:s|secs?|seconds?)$/i, second],
  [/^(?:m|mins?|minutes?)$/i, minute],
  [/^(?:h|hrs?|hours?)$/i, hour],
  [/^(?:d|days?)$/i, day],
  [/^(?:w|weeks?)$/i, week],
  [/^(?:y|yrs?|years?)$/i, year]
];

// A product of numbers, such as `60 * 60 * 24 * 365` or `1000L * 3600`, in the given unit.
function product(expression: string): number | undefined {
  const factors = expression.split("*").map((factor) => factor.trim().replace(/_/g, "").replace(/[lL]$/, ""));
  if (factors.length === 0 || factors.some((factor) => !/^\d+(?:\.\d+)?$/.test(factor))) {
    return undefined;
  }
  return factors.reduce((total, factor) => total * Number(factor), 1);
}

// Seconds in a number, a product, or a duration string. Numbers count in `numberUnit` seconds.
function seconds(expression: string, numberUnit: number): number | undefined {
  const value = expression.trim();
  const text = durationText.exec(value);
  if (text !== null) {
    const unit = textUnits.find(([pattern]) => pattern.test(text[2] ?? ""))?.[1];
    return unit === undefined ? undefined : Number(text[1]) * unit;
  }
  const number = product(value);
  return number === undefined ? undefined : number * numberUnit;
}

// Python's timedelta(days=..., weeks=..., hours=...).
function timedelta(argumentsText: string): number | undefined {
  const units: Record<string, number> = { weeks: week, days: day, hours: hour, minutes: minute, seconds: second };
  let total = 0;
  let found = false;
  for (const match of argumentsText.matchAll(/\b(weeks|days|hours|minutes|seconds)\s*=\s*([\d_.*\s]+)/g)) {
    const amount = product(match[2] ?? "");
    if (amount === undefined) {
      return undefined;
    }
    total += amount * (units[match[1] ?? ""] ?? 0);
    found = true;
  }
  const positional = /^\s*([\d_]+)\s*(?:,|$)/.exec(argumentsText);
  if (!found && positional !== null) {
    return Number(positional[1]?.replace(/_/g, "")) * day;
  }
  return found ? total : undefined;
}

// Ruby's ActiveSupport durations: 30.days, 1.year, 2.weeks.
function rubyDuration(expression: string): number | undefined {
  const match = /^\s*(\d+)\.(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/.exec(expression);
  if (match === null) {
    return undefined;
  }
  const unit = (match[2] ?? "").replace(/s$/, "");
  const units: Record<string, number> = { second, minute, hour, day, week, month: 30 * day, year };
  return Number(match[1]) * (units[unit] ?? 0);
}

// Go's time.Duration products: 24 * 365 * time.Hour or time.Hour * 24 * 365.
function goDuration(expression: string): number | undefined {
  const units: Record<string, number> = { Second: second, Minute: minute, Hour: hour };
  const unit = /\btime\.(Second|Minute|Hour)\b/.exec(expression);
  if (unit === null) {
    return undefined;
  }
  const rest = expression.replace(/\btime\.(?:Second|Minute|Hour)\b/, "1");
  const amount = product(rest);
  return amount === undefined ? undefined : amount * (units[unit[1] ?? ""] ?? 0);
}

// The expression after a key, up to the next comma, brace, or closing parenthesis at the same depth.
function expressionAt(text: string): string {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(" || character === "[" || character === "{") {
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      if (depth === 0) {
        return text.slice(0, index);
      }
      depth -= 1;
    } else if ((character === "," || character === ";") && depth === 0) {
      return text.slice(0, index);
    }
  }
  return text;
}

type Reader = { files: RegExp; context?: RegExp; pattern: RegExp; lifetime: (value: string, text: string) => number | undefined };

const javascript = /\.(?:[cm]?[jt]sx?)$/i;
// next-auth and Auth.js take a session's maxAge in seconds; express-session and cookie-session in
// milliseconds.
const nextAuth = /\bNextAuth\b|next-auth|@auth\/|\bAuthOptions\b|\bauthOptions\b/;

const readers: Reader[] = [
  // jsonwebtoken's expiresIn, in seconds or as text, and jose's setExpirationTime.
  {
    files: javascript,
    context: /\bjsonwebtoken\b|\bjwt\.sign\b|\bsign\s*\(|\bSignJWT\b/,
    pattern: /\bexpiresIn\s*:\s*(.+)$/,
    lifetime: (value) => seconds(expressionAt(value), second)
  },
  { files: javascript, pattern: /\.setExpirationTime\s*\(\s*(["'`][^"'`]+["'`])\s*\)/, lifetime: (value) => seconds(value, second) },
  // Session cookies.
  {
    files: javascript,
    context: /\bexpress-session\b|\bcookie-session\b|\bcookieSession\b|\bsession\s*\(\s*\{|\bNextAuth\b|next-auth|\bAuthOptions\b|\bauthOptions\b/,
    pattern: /\bmaxAge\s*:\s*(.+)$/,
    lifetime: (value, text) => seconds(expressionAt(value), nextAuth.test(text) ? second : 0.001)
  },
  // Django's and Flask's sessions, and access token lifetimes in Simple JWT, Flask-JWT-Extended,
  // and django-rest-framework-jwt.
  {
    files: /\.py$/i,
    pattern: /^\s*["']?(?:SESSION_COOKIE_AGE|PERMANENT_SESSION_LIFETIME|ACCESS_TOKEN_LIFETIME|JWT_ACCESS_TOKEN_EXPIRES|JWT_EXPIRATION_DELTA)["']?\s*[:=]\s*(.+)$/,
    lifetime: (value) => {
      const delta = /\btimedelta\s*\(([^)]*)\)/.exec(value);
      return delta !== null ? timedelta(delta[1] ?? "") : seconds(expressionAt(value), second);
    }
  },
  // A JWT's exp claim set to now plus a timedelta.
  {
    files: /\.py$/i,
    context: /\bjwt\.encode\b/,
    pattern: /["']exp["']\s*:\s*[^,}]*?\btimedelta\s*\(([^)]*)\)/,
    lifetime: (value) => timedelta(value)
  },
  // Rails' session store, Devise's timeout, and a JWT's exp claim.
  {
    files: /\.rb$/i,
    pattern: /\bexpire_after:\s*(.+)$|\bconfig\.timeout_in\s*=\s*(.+)$|\bexp:\s*(\d+\.\w+)\.from_now\b/,
    lifetime: (value) => rubyDuration(value)
  },
  // Go JWT claims and gorilla sessions, in seconds.
  {
    files: /\.go$/i,
    pattern: /\b(?:ExpiresAt|"exp")\s*:\s*[^\n]*?time\.Now\(\)\.Add\(\s*([^)]+)\)/,
    lifetime: (value) => goDuration(value)
  },
  { files: /\.go$/i, context: /\bsessions\./, pattern: /\bMaxAge\s*:\s*([^,}\n]+)/, lifetime: (value) => seconds(value, second) },
  // jjwt's expiration in milliseconds from now.
  {
    files: /\.(?:java|kt)$/i,
    pattern: /\b(?:setExpiration|expiration)\s*\(\s*new\s+Date\s*\(\s*System\.currentTimeMillis\(\)\s*\+\s*([^)]+)\)/,
    lifetime: (value) => seconds(value.replace(/[()]/g, ""), 0.001)
  }
];

// Refresh tokens and "remember me" sessions are meant to last longer.
const longByDesign = /refresh|remember|persistent|long[_-]?lived|offline/i;
const contextWindow = 3;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const maxLineLength = 1_000;

// Added lines that give a session or an access token a lifetime longer than 30 days.
export function findLongSessionLines(path: string, patch: string): number[] {
  const fileReaders = readers.filter(({ files }) => files.test(path));
  if (fileReaders.length === 0 || documentation.test(path) || skippedFile.test(path)) {
    return [];
  }

  const lines = patchLines(patch);
  const text = lines.map(({ content }) => content).join("\n");
  const active = fileReaders.filter(({ context }) => context === undefined || context.test(text));
  const found: number[] = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength || commentLine.test(content)) {
      return;
    }
    for (const reader of active) {
      const match = reader.pattern.exec(content);
      const value = match?.slice(1).find((group) => group !== undefined);
      if (value === undefined) {
        continue;
      }
      const lifetime = reader.lifetime(value, text);
      if (
        lifetime !== undefined &&
        lifetime > maxLifetimeSeconds &&
        !lines.slice(Math.max(0, index - contextWindow), index + contextWindow + 1).some(({ content: near }) => longByDesign.test(near))
      ) {
        found.push(line);
        return;
      }
    }
  });
  return found;
}
