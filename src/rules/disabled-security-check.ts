import { minimatch } from "minimatch";
import { addedLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Check = { label: string; high: boolean; patterns: RegExp[] };

// Assembled so this file does not match its own patterns.
const word = (...parts: string[]) => new RegExp(`(?:^|[^\\w@-])${parts.join("")}\\b`);
const insecureKubeFlag = ["--insecure", "-skip-tls-verify"].join("");

// requests' `verify=False` argument, on its own line in a multi-line call too, and `session.verify = False`.
// Other attributes named `verify` are not about TLS.
const pythonVerifyOff = /(?:[(,]\s*|^\s*|\b\w*session\.)verify\s*=\s*False\b(?!\s*[^\s,)#])/;
// Health checks and readiness probes call the local service, often with a self-signed certificate.
const localUrl = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])\b/;

const tls: Check = {
  label: "TLS certificate verification",
  high: true,
  patterns: [
    /\brejectUnauthorized\s*:\s*false\b/,
    /\bNODE_TLS_REJECT_UNAUTHORIZED\b["']?\s*[:=]\s*["']?0\b/,
    /\bstrict-ssl\b["']?\s*[=:\s]\s*["']?false\b/,
    pythonVerifyOff,
    /\bssl\._create_unverified_context\b|\bcheck_hostname\s*=\s*False\b|\bPYTHONHTTPSVERIFY\b["']?\s*[:=]\s*["']?0\b/,
    word("CERT", "_NONE"),
    word("VERIFY", "_NONE"),
    /\bInsecureSkipVerify\s*:\s*true\b/,
    word("Noop", "HostnameVerifier"),
    word("ALLOW_ALL", "_HOSTNAME_VERIFIER"),
    word("TrustAll", "Strategy"),
    /\bServerCertificate(?:Custom)?ValidationCallback\s*\+?=\s*[^;]*=>\s*true\b/,
    word("DangerousAcceptAny", "ServerCertificateValidator"),
    /\bCURLOPT_SSL_VERIFY(?:PEER|HOST)\b\s*(?:=>|,)\s*(?:false|0)\b|['"]verify['"]\s*=>\s*false\b/,
    // `curl -k`, `curl -fsSLk`, `curl --insecure`
    /\bcurl\b[^|;&\n]*\s(?:-[a-zA-Z]*k[a-zA-Z]*|--insecure)(?=\s|$)/,
    /\bwget\s[^|;&\n]*--no-check-certificate\b/,
    /\bhttp\.sslVerify\b["']?\s*[=\s]\s*["']?false\b|\bGIT_SSL_NO_VERIFY\b["']?\s*[:=]\s*["']?(?:1|true)\b/,
    /\binsecure-skip-tls-verify["']?\s*:\s*["']?true\b/,
    new RegExp(`${insecureKubeFlag}(?:=true)?(?=\\s|$)`)
  ]
};

const token: Check = {
  label: "token signature or expiry checks",
  high: true,
  patterns: [
    /["']?verify_(?:signature|exp)["']?\s*:\s*False\b/,
    /\bignoreExpiration\s*:\s*true\b/,
    /\balgorithms["']?\s*[:=]\s*\[\s*["']none["']/i,
    /\bParseUnverified\s*\(/
  ]
};

const csrf: Check = {
  label: "CSRF protection",
  high: false,
  patterns: [
    /\bcsrf\(\)\s*\.disable\(\)|\bcsrf\(\s*(?:AbstractHttpConfigurer::disable|\w+\s*->\s*\w+\.disable\(\))\s*\)/,
    word("@csrf", "_exempt"),
    /\bcsrf\.exempt\b|\bWTF_CSRF_ENABLED\s*=\s*False\b/,
    /\bskip_before_action\s+:verify_authenticity_token\b/,
    word("skip_forgery", "_protection")
  ]
};

// In the order the message lists them.
const checks = [tls, token, csrf];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const disabledSecurityCheckRule: Rule = {
  id: "disabled-security-check",
  description: "Flags code that turns off TLS certificate verification, token signature checks, or CSRF protection.",
  run({ files, config }) {
    if (!config.rules.disabledSecurityChecks.enabled) {
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

      const found = addedLines(file.patch).flatMap(({ line, content }) =>
        commentLine.test(content) ? [] : checksIn(content).map((check) => ({ line, check }))
      );
      if (found.length === 0) {
        return [];
      }

      const listed = checks.filter((check) => found.some((match) => match.check === check));
      const high = listed.some((check) => check.high);
      const { text, plural } = describeLines(found.map((match) => match.line));
      const labels = listed.map((check) => check.label);

      return [
        {
          ruleId: "disabled-security-check",
          title: "Security check turned off",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "turn off security checks" : listed.length > 1 ? "turns off security checks" : "turns off a security check"}: ${joinLabels(labels)}.`,
          recommendation:
            "Keep these checks on outside local development. Trust a private certificate authority by adding its certificate rather than turning verification off, verify tokens with the expected algorithm, and exempt from CSRF only endpoints that authenticate another way, such as signed webhooks."
        }
      ];
    });
  }
};

// Python's `verify=False` turns off TLS in requests, but token checks in older PyJWT calls.
function checksIn(content: string): Check[] {
  const matched = checks.filter(
    (check) => check.patterns.some((pattern) => pattern.test(content)) && !(check === tls && isLocalDownload(content))
  );
  return matched.includes(tls) && /\bjwt\b/i.test(content) && pythonVerifyOff.test(content)
    ? [...new Set(matched.map((check) => (check === tls ? token : check)))]
    : matched;
}

function isLocalDownload(content: string): boolean {
  return /\b(?:curl|wget)\b/.test(content) && localUrl.test(content);
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}
