import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "protocol" | "cipher";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  protocol: ["allows SSL 3, TLS 1.0, or TLS 1.1", "allow SSL 3, TLS 1.0, or TLS 1.1"],
  cipher: ["allows RC4, DES, NULL, export, or anonymous cipher suites", "allow RC4, DES, NULL, export, or anonymous cipher suites"]
};

// An old protocol by its name in OpenSSL and server settings: SSLv3, TLSv1, or TLSv1.1, but not
// TLSv1.2 or TLSv1.3.
const oldName = String.raw`(?:SSLv[23]|TLSv1(?:\.1)?)(?![.\d])`;

const settings: Array<{ files: RegExp; pattern: RegExp }> = [
  // Node.js tls and https options.
  {
    files: /\.(?:[cm]?[jt]sx?)$/i,
    pattern: new RegExp(String.raw`\bminVersion\s*:\s*["']${oldName}["']|\bsecureProtocol\s*:\s*["'](?:SSLv[23]|TLSv1(?:_1)?)_(?:client_|server_)?method["']`)
  },
  // Python's ssl module, where a context or connection is given the protocol. Compatibility tables
  // that map the constants, as urllib3's do, are not settings.
  {
    files: /\.py$/i,
    pattern: /\b(?:ssl_version|minimum_version|maximum_version|protocol)\s*=\s*(?:ssl\.)?(?:PROTOCOL_(?:SSLv2|SSLv3|TLSv1|TLSv1_1)|TLSVersion\.(?:SSLv3|TLSv1|TLSv1_1))\b|\bSSLContext\s*\(\s*(?:ssl\.)?PROTOCOL_(?:SSLv2|SSLv3|TLSv1|TLSv1_1)\b/
  },
  // Go's crypto/tls.
  { files: /\.go$/i, pattern: /\b(?:Min|Max)Version\s*:\s*tls\.Version(?:SSL30|TLS10|TLS11)\b/ },
  // Java and Kotlin: an SSLContext for an old protocol, or old protocols enabled by name.
  { files: /\.(?:java|kt)$/i, pattern: new RegExp(String.raw`\bSSLContext\.getInstance\s*\(\s*"${oldName}"|\bsetEnabledProtocols\s*\(.*"${oldName}"`) },
  // .NET.
  { files: /\.cs$/i, pattern: /\b(?:SslProtocols|SecurityProtocolType)\.(?:Ssl2|Ssl3|Tls|Tls11)\b(?!\d)/ },
  // Ruby's OpenSSL.
  { files: /\.rb$/i, pattern: /\bssl_version\s*=\s*:(?:SSLv3|TLSv1|TLSv1_1)\b|\bmin_version\s*=\s*(?::(?:SSL3|TLS1|TLS1_1)\b|OpenSSL::SSL::(?:SSL3|TLS1|TLS1_1)_VERSION\b)/ },
  // PHP streams and cURL.
  { files: /\.php$/i, pattern: /\bSTREAM_CRYPTO_METHOD_(?:SSLv[23]|TLSv1_[01])_(?:CLIENT|SERVER)\b|\bCURL_SSLVERSION_(?:SSLv[23]|TLSv1|TLSv1_[01])\b/ },
  // nginx, and Spring's server.ssl.enabled-protocols.
  { files: /\.conf$|(?:^|\/)nginx[^/]*$|\.(?:properties|ya?ml)$/i, pattern: new RegExp(String.raw`\bssl_protocols\s+[^;#]*\b${oldName}|\benabled-protocols\s*[:=][^#]*\b${oldName}`) },
  // Apache: an old protocol turned on, or `all` without turning the old ones off.
  { files: /\.conf$|(?:^|\/)(?:httpd|apache2?)[^/]*$|\.htaccess$/i, pattern: new RegExp(String.raw`^\s*SSLProtocol\s+(?:[^#]*(?:^|\s)\+?${oldName}|(?![^#]*-TLSv1(?![.\d]))[^#]*\ball\b)`, "i") },
  // AWS load balancer policies and CloudFront minimum protocols that allow TLS 1.0 or 1.1.
  {
    files: /\.(?:tf|tf\.json|ya?ml|json)$/i,
    pattern: /\bssl_policy\s*=\s*"ELBSecurityPolicy-(?:2015-05|2016-08|TLS-1-0-2015-04|TLS-1-1-2017-01)"|\bminimum_protocol_version\s*=\s*"(?:SSLv3|TLSv1|TLSv1_2016|TLSv1\.1_2016)"|["']?SslPolicy["']?\s*:\s*["']?ELBSecurityPolicy-(?:2015-05|2016-08|TLS-1-0-2015-04|TLS-1-1-2017-01)\b/
  }
];

// Cipher lists in OpenSSL's format, in server settings and Node.js options. A suite counts when it
// is added, not when it is removed with `!` or `-`.
const cipherList = /\b(?:ssl_ciphers|SSLCipherSuite|ciphers)\b\s*[:=]?\s*["']?([A-Za-z0-9!+@:_.\-]+)/;
const weakSuite = /^(?:.*[-_])?(?:RC4|DES|3DES|NULL|eNULL|aNULL|EXPORT|EXP|ADH|AECDH)(?:[-_].*)?$/;
const cipherFiles = /\.(?:conf|[cm]?[jt]sx?|ya?ml)$|(?:^|\/)(?:nginx|httpd|apache2?|haproxy)[^/]*$/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const weakTlsRule: Rule = {
  id: "weak-tls",
  description: "Flags TLS settings that allow SSL 3, TLS 1.0, TLS 1.1, or broken cipher suites.",
  run({ files, config }) {
    if (!config.rules.weakTls.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const readsCiphers = cipherFiles.test(file.path);
      if (
        (fileSettings.length === 0 && !readsCiphers) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; kind: Kind }> = [];
      // Python docstrings document old settings, as gunicorn's and docker's do.
      let inDocstring = false;
      for (const { line, content, added, startsHunk } of patchLines(file.patch)) {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        if (fileSettings.some(({ pattern }) => pattern.test(content))) {
          found.push({ line, kind: "protocol" });
        }
        if (readsCiphers && addsWeakCipher(content)) {
          found.push({ line, kind: "cipher" });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "weak-tls",
          title: "Old TLS version or cipher allowed",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, which attacks such as POODLE, BEAST, and Sweet32 can break or downgrade a connection to.`,
          recommendation:
            "Require TLS 1.2 or later, such as `minVersion: \"TLSv1.2\"`, `ssl.TLSVersion.TLSv1_2`, `tls.VersionTLS12`, or `ssl_protocols TLSv1.2 TLSv1.3`, and use the cipher suites a current guide such as Mozilla's intermediate configuration lists. On AWS, use a policy such as `ELBSecurityPolicy-TLS13-1-2-2021-06`."
        }
      ];
    });
  }
};

function addsWeakCipher(content: string): boolean {
  const list = cipherList.exec(content)?.[1];
  if (list === undefined || !list.includes(":") && !weakSuite.test(list)) {
    return false;
  }
  return list.split(":").some((suite) => suite !== "" && !/^[!-]/.test(suite) && weakSuite.test(suite.replace(/^\+/, "")));
}
