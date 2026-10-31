import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Kind = "csp" | "framing" | "transport";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  csp: "a Content-Security-Policy that is off or lets inline or injected scripts run",
  framing: "framing protection turned off, which allows clickjacking",
  transport: "HTTPS enforcement or MIME type sniffing protection turned off"
};

const settings: Array<{ kind: Kind | Kind[]; files: RegExp; pattern: RegExp }> = [
  // helmet's options for Express and Fastify.
  { kind: "csp", files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\bcontentSecurityPolicy\s*:\s*false\b/ },
  { kind: "framing", files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\b(?:frameguard|xFrameOptions)\s*:\s*false\b/ },
  { kind: "transport", files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\b(?:hsts|strictTransportSecurity|noSniff|xContentTypeOptions)\s*:\s*false\b/ },
  // A header removed, or X-Frame-Options set to let any site frame the page.
  { kind: "framing", files: /\.(?:[cm]?[jt]sx?|py|rb|php|go|java|kt|cs)$/i, pattern: /\b(?:removeHeader|remove|delete|Del|del)\s*\(\s*["']X-Frame-Options["']|["']X-Frame-Options["']\s*[,:=]\s*["']ALLOW(?:ALL|-FROM\s+\*)["']/i },
  // Django.
  { kind: "framing", files: /\.py$/i, pattern: /^\s*X_FRAME_OPTIONS\s*=\s*["'](?!DENY|SAMEORIGIN)[^"']*["']|@xframe_options_exempt\b/ },
  { kind: "transport", files: /\.py$/i, pattern: /^\s*(?:SECURE_SSL_REDIRECT|SECURE_CONTENT_TYPE_NOSNIFF)\s*=\s*False\b|^\s*SECURE_HSTS_SECONDS\s*=\s*0\b/ },
  // Flask-Talisman.
  { kind: "csp", files: /\.py$/i, pattern: /\bTalisman\s*\([^)]*\bcontent_security_policy\s*=\s*(?:None|False)\b/ },
  { kind: "transport", files: /\.py$/i, pattern: /\bTalisman\s*\([^)]*\b(?:force_https|strict_transport_security|content_type_nosniff)\s*=\s*False\b/ },
  // Rails.
  { kind: "transport", files: /\.rb$/i, pattern: /\bconfig\.force_ssl\s*=\s*false\b/ },
  { kind: "framing", files: /\.rb$/i, pattern: /\bdefault_headers\.delete\s*\(\s*["']X-Frame-Options["']\s*\)|\bdefault_headers\s*\[\s*["']X-Frame-Options["']\s*\]\s*=\s*["']ALLOWALL["']/ },
  // Spring Security.
  { kind: "framing", files: /\.(?:java|kt)$/i, pattern: /\.frameOptions\s*\(\s*\)\s*\.disable\s*\(|\.frameOptions\s*\(\s*\w+\s*->\s*\w+\.disable\s*\(\s*\)\s*\)|\bFrameOptionsConfig::disable\b/ },
  { kind: "transport", files: /\.(?:java|kt)$/i, pattern: /\.(?:httpStrictTransportSecurity|contentTypeOptions)\s*\(\s*\)\s*\.disable\s*\(|\.(?:httpStrictTransportSecurity|contentTypeOptions)\s*\(\s*\w+\s*->\s*\w+\.disable\s*\(\s*\)\s*\)/ },
  // Turning off every header.
  { kind: ["csp", "framing", "transport"], files: /\.(?:java|kt)$/i, pattern: /\.headers\s*\(\s*\)\s*\.disable\s*\(|\.headers\s*\(\s*\w+\s*->\s*\w+\.disable\s*\(\s*\)\s*\)|\bHeadersConfigurer::disable\b/ }
];

// A Content-Security-Policy whose script sources allow inline scripts, eval, or any origin: in a
// header written as text, a <meta> tag, nginx's add_header, helmet's directives, Django CSP, or
// Rails' policy DSL.
const cspText = /Content-Security-Policy|content_security_policy|contentSecurityPolicy|\bCSP_(?:SCRIPT_SRC|DEFAULT_SRC)\b|\b(?:scriptSrc|defaultSrc|script_src|default_src)\b/i;
const weakScriptSource =
  /(?:script-src|default-src)\s[^;"`\n]*?(?:'unsafe-inline'|'unsafe-eval'|(?<=\s)\*(?=[\s;"'`]|$))|\b(?:scriptSrc|defaultSrc|CSP_SCRIPT_SRC|CSP_DEFAULT_SRC)\b[^\]\n)]*["']'unsafe-(?:inline|eval)'["']|\b(?:script_src|default_src)\b[^\n]*:unsafe_(?:inline|eval)\b/i;

// Django's own defaults file lists every setting at its default.
const djangoDefaults = /(?:^|\/)django\/conf\/global_settings\.py$/i;

const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|php|go|java|kt|cs|html?|conf|ejs|hbs|erb)$|(?:^|\/)nginx[^/]*$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc)$/i;
const maxLineLength = 1_000;

export const securityHeadersRule: Rule = {
  id: "security-headers",
  description: "Flags Content-Security-Policy, framing, HSTS, and MIME sniffing protections turned off or weakened.",
  run({ files, config }) {
    if (!config.rules.securityHeaders.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps turn these off on purpose.
        developmentPath.test(file.path) ||
        djangoDefaults.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; kind: Kind }> = [];
      // Python docstrings show decorators and settings as usage examples, as Django's do.
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
        for (const { kind, pattern } of fileSettings) {
          if (pattern.test(content)) {
            found.push(...[kind].flat().map((each) => ({ line, kind: each })));
          }
        }
        if (cspText.test(content) && weakScriptSource.test(content)) {
          found.push({ line, kind: "csp" });
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
          ruleId: "security-headers",
          title: "Security header weakened",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "set" : "sets"} ${kinds.map((kind) => labels[kind]).join(", and ")}, removing a layer that stops cross-site scripting, clickjacking, or downgrade attacks when other defenses fail.`,
          recommendation:
            "Keep helmet's and the framework's defaults on, and narrow them where a page needs it: allow a specific origin or a nonce in `script-src` instead of `'unsafe-inline'`, use `frame-ancestors` or `SAMEORIGIN` instead of turning framing protection off, and keep HSTS and `nosniff` on in production."
        }
      ];
    });
  }
};
