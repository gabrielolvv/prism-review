import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; files: RegExp; pattern: RegExp };

const terraform = /\.(?:tf|tf\.json|hcl)$/i;
const templates = /\.(?:json|ya?ml|template|bicep)$/i;
const cdk = /\.(?:[cm]?[jt]s|py|java|go|cs)$/i;

const settings: Setting[] = [
  // CloudFront distributions that answer viewers over HTTP.
  { label: "a CloudFront distribution", files: terraform, pattern: /^\s*viewer_protocol_policy\s*=\s*"allow-all"/ },
  { label: "a CloudFront distribution", files: templates, pattern: /["']?ViewerProtocolPolicy["']?\s*:\s*["']?allow-all\b/ },
  // Uses of the CDK's value, not the SDK's own enum and its lookup table.
  { label: "a CloudFront distribution", files: cdk, pattern: /^(?!\s*["']ALLOW_ALL["']\s*:)(?!.*\bViewerProtocolPolicy_ALLOW_ALL\s+ViewerProtocolPolicy\b).*\bViewerProtocolPolicy[._]ALLOW_ALL\b/ },
  // Azure App Service, Function Apps, and Storage accounts that accept HTTP.
  { label: "an Azure web app or storage account", files: terraform, pattern: /^\s*(?:https_only|https_traffic_only_enabled|enable_https_traffic_only)\s*=\s*false\b/ },
  { label: "an Azure web app or storage account", files: templates, pattern: /["']?(?:httpsOnly|supportsHttpsTrafficOnly)["']?\s*:\s*false\b/ },
  // App Engine handlers that serve HTTP without redirecting it.
  { label: "an App Engine handler", files: /(?:^|\/)app\.ya?ml$/i, pattern: /^\s*-?\s*secure\s*:\s*["']?(?:optional|never)\b/ },
  // ingress-nginx's redirect to HTTPS turned off.
  { label: "an ingress-nginx ingress", files: /\.(?:ya?ml|tpl|json)$/i, pattern: /\bnginx\.ingress\.kubernetes\.io\/(?:force-)?ssl-redirect["']?\s*:\s*["']false["']|^\s*["']?ssl-redirect["']?\s*:\s*["']false["']/ }
];

// Load balancer listeners on plain HTTP whose whole block is in the change and that do not redirect.
const listenerHeader = /^\s*resource\s+"aws_(?:lb|alb)_listener"\s|^\s*Type\s*:\s*["']?AWS::ElasticLoadBalancingV2::Listener\b|^\s*"Type"\s*:\s*"AWS::ElasticLoadBalancingV2::Listener"/;
const httpProtocol = /^\s*["']?(?:protocol|Protocol)["']?\s*[:=]\s*["']HTTP["']|^\s*Protocol\s*:\s*HTTP\s*$/;
const redirect = /\btype\s*=\s*"redirect"|\bRedirectConfig\b|["']?Type["']?\s*:\s*["']?redirect\b/i;
const blockEnd = /^\s*resource\s+"|^\s*(?:data|module|output|variable)\s+"|^ {2}[A-Za-z][\w]*\s*:\s*$|^\s*"[A-Za-z][\w]*"\s*:\s*\{\s*$/;
const listenerWindow = 40;

const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\/|__snapshots__|\.snap$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$|\.schema\.json$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const describesValues = /\b(?:description|help)\s*[:=]/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const plainHttpEndpointRule: Rule = {
  id: "plain-http-endpoint",
  description: "Flags load balancers, CDNs, and app platforms set to serve plain HTTP without redirecting it to HTTPS.",
  run({ files, config }) {
    if (!config.rules.plainHttpEndpoint.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const listeners = terraform.test(file.path) || templates.test(file.path);
      if (
        (fileSettings.length === 0 && !listeners) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test stacks.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; label: string }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        const setting = fileSettings.find(({ pattern }) => pattern.test(content));
        if (setting !== undefined) {
          found.push({ line, label: setting.label });
          return;
        }
        if (listeners && listenerHeader.test(content)) {
          const block = listenerBlock(lines, index);
          const http = block.find(({ content: other }) => httpProtocol.test(other));
          // A listener a module creates only when its caller turns the redirect off, such as
          // `count = var.http_redirect != true ? 1 : 0`, is the caller's choice.
          if (http !== undefined && !block.some(({ content: other }) => redirect.test(other) || /\bvar\.\w*redirect\w*/i.test(other))) {
            found.push({ line: http.line, label: "a load balancer listener" });
          }
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((a, b) => a - b);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "plain-http-endpoint",
          title: "Endpoint serves plain HTTP",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} ${listOf(labels)} serve plain HTTP without redirecting it to HTTPS, so anyone on the network path, such as a public Wi-Fi network, can read and change pages, session cookies, and credentials.`,
          recommendation:
            "Redirect HTTP to HTTPS: CloudFront's `redirect-to-https` or `https-only`, a listener whose default action redirects to port 443, Azure's `https_only = true`, App Engine's `secure: always`, and ingress-nginx's default `ssl-redirect`. Send HSTS once every page is on HTTPS."
        }
      ];
    });
  }
};

// The lines of the listener resource that starts at the index, up to the next resource or a window.
function listenerBlock(lines: Array<{ line: number; content: string }>, index: number): Array<{ line: number; content: string }> {
  const block: Array<{ line: number; content: string }> = [];
  for (let after = index + 1; after < Math.min(lines.length, index + listenerWindow); after += 1) {
    const entry = lines[after];
    if (entry === undefined || blockEnd.test(entry.content)) {
      break;
    }
    block.push(entry);
  }
  return block;
}
