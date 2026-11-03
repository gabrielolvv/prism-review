import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// A limit this high on failed logins lets an attacker try a list of common passwords before it locks.
const highLimit = 100;

const turnedOff: Array<{ files: RegExp; pattern: RegExp; context?: RegExp }> = [
  // django-axes, django-ratelimit, and Flask-Limiter turned off.
  { files: /\.py$/i, pattern: /^\s*(?:AXES_ENABLED|RATELIMIT_ENABLE|RATELIMIT_ENABLED)\s*=\s*False\b|^\s*\w*limiter\.enabled\s*=\s*False\b/i },
  // Rack::Attack turned off, and Devise's lockout set to none.
  { files: /\.rb$/i, pattern: /\bRack::Attack\.enabled\s*=\s*false\b|\bconfig\.lock_strategy\s*=\s*:none\b/ },
  // ASP.NET Core Identity: a sign-in that never locks the account, and lockout off for new users.
  { files: /\.(?:cs|cshtml)$/i, pattern: /\blockoutOnFailure\s*:\s*false\b|\bLockout\.AllowedForNewUsers\s*=\s*false\b/ },
  // express-rate-limit and similar limiters told to skip every request.
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    context: /\brateLimit\b|\bRateLimit\b|express-rate-limit|express-slow-down|\bslowDown\b/,
    pattern: /\bskip\s*:\s*(?:\(\s*\)|\w+|\([^)]*\))\s*=>\s*true\b/
  },
  // NestJS's throttler skipped on a login or authentication controller.
  { files: /(?:auth|login|signin|session)[^/]*\.(?:[cm]?[jt]s)$/i, pattern: /@SkipThrottle\s*\(\s*\)/ },
  // Keycloak realm exports.
  { files: /\.json$/i, pattern: /["']bruteForceProtected["']\s*:\s*false\b/ }
];

// Lockout thresholds of 100 failed attempts or more.
const highThresholds: Array<{ files: RegExp; pattern: RegExp }> = [
  { files: /\.py$/i, pattern: /^\s*AXES_FAILURE_LIMIT\s*=\s*([\d_]+)\b/ },
  { files: /\.rb$/i, pattern: /\bconfig\.maximum_attempts\s*=\s*([\d_]+)\b/ },
  { files: /\.cs$/i, pattern: /\bMaxFailedAccessAttempts\s*=\s*([\d_]+)\b/ },
  { files: /\.json$/i, pattern: /["']failureFactor["']\s*:\s*(\d+)\b/ }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|@\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const bruteForceProtectionRule: Rule = {
  id: "brute-force-protection",
  description: "Flags login rate limits and account lockout turned off, or set to allow 100 or more failed attempts.",
  run({ files, config }) {
    if (!config.rules.bruteForceProtection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const settings = turnedOff.filter(({ files: pattern }) => pattern.test(file.path));
      const thresholds = highThresholds.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        (settings.length === 0 && thresholds.length === 0) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps turn limits off on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = settings.filter(({ context }) => context === undefined || context.test(text));
      const found: number[] = [];
      for (const { line, content, added } of lines) {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        if (
          active.some(({ pattern }) => pattern.test(content)) ||
          thresholds.some(({ pattern }) => Number((pattern.exec(content)?.[1] ?? "0").replace(/_/g, "")) >= highLimit)
        ) {
          found.push(line);
        }
      }
      if (found.length === 0) {
        return [];
      }

      const { text: where, plural } = describeLines(found);
      return [
        {
          ruleId: "brute-force-protection",
          title: "Brute-force protection off",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${where} ${plural ? "turn off or loosen" : "turns off or loosens"} the limit on failed logins, so an attacker can try password after password, from leaked lists or by guessing, against an account until one works.`,
          recommendation:
            "Keep login rate limits and account lockout on in production, with a limit of a few to a few dozen failed attempts per account and per IP address, and add a CAPTCHA or a growing delay after repeated failures. Turn them off only in test settings."
        }
      ];
    });
  }
};
