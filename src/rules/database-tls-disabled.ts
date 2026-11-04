import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "off" | "unverified";

// Connection strings, URLs, and DSNs that turn TLS off or stop checking the server's certificate.
// Each pattern's first group holds the host the connection goes to.
const connections: Array<{ pattern: RegExp; settings: RegExp; unverified: RegExp }> = [
  // postgres://user@host/db?sslmode=disable
  {
    pattern: /\bpostgres(?:ql)?(?:\+\w+)?:\/\/(?:[^@\/\s"'`]*@)?([^\/:?\s"'`,]+)[^\s"'`]*/gi,
    settings: /[?&]sslmode=disable\b/i,
    unverified: /^$/
  },
  // libpq's keyword form: host=db.acme.io ... sslmode=disable
  {
    pattern: /\bhost\s*=\s*([^\s"'`;]+)[^"'`\n]*/gi,
    settings: /\bsslmode\s*=\s*disable\b/i,
    unverified: /^$/
  },
  // JDBC URLs for MySQL, MariaDB, Postgres, and SQL Server.
  {
    pattern: /\bjdbc:(?:mysql|mariadb|postgresql|sqlserver):\/\/([^\/:;?\s"'`]+)[^\s"'`]*/gi,
    settings: /[?&;](?:useSSL=false|sslMode=DISABLED|requireSSL=false|sslmode=disable|encrypt=false)\b/i,
    unverified: /[?&;]trustServerCertificate=true\b/i
  },
  // mysql://user@host/db?ssl-mode=DISABLED, and Go's user:pass@tcp(host:3306)/db?tls=false
  {
    pattern: /\b(?:mysql|mariadb)(?:\+\w+)?:\/\/(?:[^@\/\s"'`]*@)?([^\/:?\s"'`,]+)[^\s"'`]*|@tcp\(\s*([^:)\s]+)[^)]*\)[^\s"'`]*/gi,
    settings: /[?&](?:ssl-mode=DISABLED|sslmode=disable|ssl=false|tls=false|useSSL=false)\b/i,
    unverified: /[?&]tls=skip-verify\b/i
  },
  // mongodb://host/db?tls=false
  {
    pattern: /\bmongodb(?:\+srv)?:\/\/(?:[^@\/\s"'`]*@)?([^\/:?\s"'`,]+)[^\s"'`]*/gi,
    settings: /[?&](?:tls|ssl)=false\b/i,
    unverified: /[?&](?:tlsAllowInvalidCertificates|tlsAllowInvalidHostnames|tlsInsecure|sslAllowInvalidCertificates)=true\b/i
  },
  // SQL Server's ADO.NET connection strings.
  {
    pattern: /\b(?:Server|Data Source|Address|Addr|Network Address)\s*=\s*(?:tcp:)?([^;,"'\s]+)[^"'\n]*/gi,
    settings: /\bEncrypt\s*=\s*(?:False|no|Optional)\b/i,
    unverified: /\bTrustServerCertificate\s*=\s*(?:True|yes)\b/i
  }
];

// tedious's and node-mssql's options, whose server is set a few lines away.
const optionOff = /\bencrypt\s*:\s*false\b/;
const optionUnverified = /\btrustServerCertificate\s*:\s*true\b/;
const optionHost = /\b(?:server|host)\s*:\s*["'`]([^"'`]+)["'`]/;
const optionWindow = 8;

// A host on the same machine or a private container network, such as Compose's `db` service, or a
// name that is filled in later.
const localHost = /^(?:localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal|[^.]+|.*\.local|.*\.localhost|.*\.internal|.*\.svc(?:\.cluster\.local)?)$/i;
const placeholderHost = /[{}$<>%]|\bexample\.(?:com|org|net)\b|\b(?:your|my)[-_]?(?:host|server|db|database)\b|^host$|^hostname$/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|;|<!--|--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|\.lock$|(?:^|\/)package-lock\.json$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 2_000;

export const databaseTlsDisabledRule: Rule = {
  id: "database-tls-disabled",
  description: "Flags database connections to other hosts with TLS turned off or the server's certificate unchecked.",
  run({ files, config }) {
    if (!config.rules.databaseTlsDisabled.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test setups talk to throwaway databases.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; host: string; kind: Kind }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const match = connectionOnLine(content) ?? optionsNear(lines, index, content);
        if (match !== undefined) {
          found.push({ line, ...match });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const hosts = [...new Set(found.map(({ host }) => host))];
      const how =
        found.every(({ kind }) => kind === "unverified")
          ? "without checking the server's certificate"
          : found.every(({ kind }) => kind === "off")
            ? "without TLS"
            : "without TLS or without checking the server's certificate";
      return [
        {
          ruleId: "database-tls-disabled",
          title: "Database connection without TLS",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "connect" : "connects"} to ${listOf(hosts)} ${how}, so the database password and every query and result cross the network where anyone on the path can read them or, by posing as the server, change them.`,
          recommendation:
            "Require TLS and check the certificate, such as Postgres's `sslmode=verify-full`, MySQL's `ssl-mode=VERIFY_IDENTITY`, SQL Server's `Encrypt=True` without `TrustServerCertificate`, and MongoDB's `tls=true`, with the provider's CA bundle. Keep TLS off only for databases on the same host or a private container network."
        }
      ];
    });
  }
};

function connectionOnLine(content: string): { host: string; kind: Kind } | undefined {
  for (const { pattern, settings, unverified } of connections) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const host = (match[1] ?? match[2] ?? "").replace(/^\[|\]$/g, "");
      const kind: Kind | undefined = settings.test(match[0]) ? "off" : unverified.test(match[0]) ? "unverified" : undefined;
      if (kind !== undefined && remote(host)) {
        return { host, kind };
      }
    }
  }
  return undefined;
}

function optionsNear(lines: Array<{ content: string }>, index: number, content: string): { host: string; kind: Kind } | undefined {
  const kind: Kind | undefined = optionOff.test(content) ? "off" : optionUnverified.test(content) ? "unverified" : undefined;
  if (kind === undefined) {
    return undefined;
  }
  const nearby = lines.slice(Math.max(0, index - optionWindow), index + optionWindow + 1);
  const host = nearby.map(({ content: other }) => optionHost.exec(other)?.[1]).find((value) => value !== undefined);
  return host !== undefined && remote(host) ? { host, kind } : undefined;
}

// A host on the network that is written out, not one on the same machine or filled in later.
function remote(host: string): boolean {
  return host !== "" && !localHost.test(host) && !placeholderHost.test(host);
}
