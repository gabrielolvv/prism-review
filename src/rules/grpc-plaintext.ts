import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// gRPC channels and servers without TLS, in each language's library.
const plaintext: Array<{ files: RegExp; pattern: RegExp }> = [
  // grpcio's insecure channel, and a server port without TLS on every interface.
  { files: /\.py$/i, pattern: /\bgrpc\.(?:aio\.)?insecure_channel\s*\(|\.add_insecure_port\s*\(\s*f?["'](?:\[::\]|0\.0\.0\.0|):/ },
  // grpc-go's deprecated WithInsecure and the insecure credentials package.
  { files: /\.go$/i, pattern: /\bgrpc\.WithInsecure\s*\(\s*\)|\binsecure\.NewCredentials\s*\(\s*\)/ },
  // grpc-java's and grpc-kotlin's plaintext builders.
  { files: /\.(?:java|kt|scala)$/i, pattern: /\.usePlaintext\s*\(\s*(?:true\s*)?\)/ },
  // grpc-js credentials.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\b(?:credentials|ChannelCredentials|ServerCredentials)\.createInsecure\s*\(\s*\)/ },
  // Grpc.Net.Client and Grpc.Core.
  { files: /\.cs$/i, pattern: /\bChannelCredentials\.Insecure\b|\bServerCredentials\.Insecure\b/ }
];

// Local targets, such as a sidecar or a test server, which plaintext is fine for.
const localTarget = /\bLOCAL_?(?:TARGET|HOST|ADDRESS|ADDR)\b|\bchannelOverride\b|["'`](?:(?:dns:\/\/\/?|https?:\/\/)?(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?|unix:[^"'`]*|unix-abstract:[^"'`]*)["'`]|\bforAddress\s*\(\s*["'](?:localhost|127\.0\.0\.1)["']|\bInProcess(?:Channel|Server)Builder\b|\bbufconn\b/i;
const localWindow = 3;

// A library's own definition of the call, an import, and a fallback when no credentials are given,
// as nice-grpc's and Temporal's clients use, are not a choice of plaintext.
const definitionOrImport = /^\s*(?:def|func|static|public|private|protected|export\s+function|from\s+[\w.]+\s+import|import)\b[^=]*\b(?:insecure_channel|createInsecure|usePlaintext|WithInsecure|add_insecure_port)\b|^\s*import\b/;
const fallback = /\?\?\s*[\w.]*(?:createInsecure|insecure)|\?\s*[^:]+:\s*[\w.]*createInsecure|\bor\s+grpc\.(?:aio\.)?insecure_channel|\belse\s+grpc\.(?:aio\.)?insecure_channel/;

// Clients that offer TLS as an option choose plaintext behind a condition.
const guard = /\bif\b|\belse\b|\belif\b|\bunless\b|\bswitch\b|\bcase\b|\bdefault\s*:|\s\?\s/;
// A secure channel next to the plaintext one means the code chooses between them, as Dapr's client
// does by the address's scheme.
const secureOption = /\bsecure_channel\b|\bssl_channel_credentials\b|\bcreateSsl\b|\bNewTLS\b|\bNewClientTLSFromFile\b|\buseTransportSecurity\b|\bSecureSsl\b|\bSslCredentials\b|\bwithTls\b|\bTlsChannelCredentials\b/;
const secureWindow = 6;
// The function that defines the call, such as Go's `func WithInsecure()`.
const definesCall = /^\s*(?:def|func|static|public|private|protected|export\s+function|function)\b[^=]*\b(?:insecure_channel|createInsecure|usePlaintext|WithInsecure|add_insecure_port|NewCredentials)\b/;
const guardWindow = 2;
const blockWindow = 30;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const grpcPlaintextRule: Rule = {
  id: "grpc-plaintext",
  description: "Flags gRPC channels and servers set up without TLS to hosts other than localhost.",
  run({ files, config }) {
    if (!config.rules.grpcPlaintext.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const patterns = plaintext.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        patterns.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, test, and benchmark code talks to local servers.
        developmentPath.test(file.path) ||
        /(?:^|\/)(?:bench(?:mark)?s?|interop|stubserver|testutils?)(?:\/|$)/i.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const python = /\.py$/i.test(file.path);
      const lines = patchLines(file.patch);
      const found: number[] = [];
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (
          !added ||
          wasInDocstring ||
          content.length > maxLineLength ||
          commentLine.test(content) ||
          definitionOrImport.test(content) ||
          fallback.test(content)
        ) {
          return;
        }
        // A call inside a string, such as an error message that names it, is not a call.
        const called = patterns.some(({ pattern }) => {
          const match = pattern.exec(content);
          return match !== null && !insideString(content, match.index);
        });
        if (!called || enclosingBlocks(lines, index).some((block) => definesCall.test(block))) {
          return;
        }
        if (lines.slice(Math.max(0, index - secureWindow), index + secureWindow + 1).some(({ content: other }) => secureOption.test(other))) {
          return;
        }
        const near = lines.slice(Math.max(0, index - localWindow), index + localWindow + 1);
        if (near.some(({ content: other }) => localTarget.test(other))) {
          return;
        }
        if (lines.slice(Math.max(0, index - guardWindow), index + 1).some(({ content: before }) => guard.test(before)) || guard.test(enclosingBlock(lines, index))) {
          return;
        }
        found.push(line);
      });
      if (found.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(found);
      return [
        {
          ruleId: "grpc-plaintext",
          title: "gRPC without TLS",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${text} ${plural ? "set up gRPC connections" : "sets up a gRPC connection"} without TLS, so requests, responses, and the credentials in their metadata, such as bearer tokens and API keys, cross the network in plain text that anyone on the path can read or change.`,
          recommendation:
            "Use TLS credentials, such as `grpc.ssl_channel_credentials()` with `secure_channel`, `credentials.NewTLS` in Go, `useTransportSecurity()` in Java, or `credentials.createSsl()` in Node.js, or rely on a service mesh that adds mutual TLS and say so next to the call. Keep plaintext for localhost and Unix sockets."
        }
      ];
    });
  }
};

// The nearest line before that is indented less, which opens the block this line is in.
function enclosingBlock(lines: Array<{ content: string }>, index: number): string {
  const indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - blockWindow); before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      return content;
    }
  }
  return "";
}

// Whether the text before `index` leaves a quote open.
function insideString(content: string, index: number): boolean {
  const before = content.slice(0, index).replace(/\\./g, "");
  return ["'", '"', "`"].some((quote) => (before.split(quote).length - 1) % 2 === 1);
}

// Every line before that opens a block this line is in, from the nearest outward.
function enclosingBlocks(lines: Array<{ content: string }>, index: number): string[] {
  const blocks: string[] = [];
  let indent = lines[index]?.content.search(/\S/) ?? 0;
  for (let before = index - 1; before >= Math.max(0, index - blockWindow) && indent > 0; before -= 1) {
    const content = lines[before]?.content ?? "";
    const start = content.search(/\S/);
    if (start >= 0 && start < indent) {
      blocks.push(content);
      indent = start;
    }
  }
  return blocks;
}
