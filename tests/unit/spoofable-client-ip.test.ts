import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { spoofableClientIpRule } from "../../src/rules/spoofable-client-ip.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return spoofableClientIpRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testSpoofableClientIpReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/server.ts", [
      "app.set('trust proxy', true);",
      "",
      "export function clientIp(req: Request): string {",
      "  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Client IP can be spoofed");
  assert.deepEqual(finding?.lines, [1, 4]);
  assert.equal(
    finding?.message,
    "Lines 1, 4 take the client's address from X-Forwarded-For without checking which proxy added it, so a client can send any address it likes and get around IP allowlists, rate limits, and lockouts, or hide its own address in the logs."
  );
}

export function testSpoofableClientIpReadsEachPlatform(): void {
  const cases: Array<[string, string[]]> = [
    ["src/app.js", ["app.enable('trust proxy');"]],
    ["src/app.ts", ["import Fastify from 'fastify';", "const app = Fastify({ trustProxy: true });"]],
    ["src/ip.js", ["const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;"]],
    ["src/app.js", ["if (process.env.NODE_ENV === 'production') app.set('trust proxy', true);"]],
    ["app/views.py", ["    ip = request.headers.get('X-Forwarded-For', request.remote_addr)"]],
    ["app/views.py", ["    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()"]],
    ["internal/http/ip.go", ["\tip := strings.Split(r.Header.Get(\"X-Forwarded-For\"), \",\")[0]"]],
    ["src/main/java/com/acme/Ip.java", ["    String ip = request.getHeader(\"X-Forwarded-For\").split(\",\")[0];"]],
    ["app/controllers/application_controller.rb", ["    ip = request.headers['X-Forwarded-For'].to_s.split(',').first"]],
    ["src/Ip.php", ["$ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];"]],
    ["Api/Program.cs", ["options.KnownNetworks.Clear();", "options.KnownProxies.Clear();"]],
    ["internal/server.go", ["\trouter.SetTrustedProxies([]string{\"0.0.0.0/0\"})"]],
    ["src/main/resources/application.properties", ["server.tomcat.remoteip.internal-proxies=.*"]],
    ["deploy/nginx/site.conf", ["set_real_ip_from 0.0.0.0/0;", "real_ip_header X-Forwarded-For;"]],
    ["deploy/apache/remoteip.conf", ["RemoteIPHeader X-Forwarded-For", "RemoteIPTrustedProxy 0.0.0.0/0"]],
    ["docker-compose.yml", ["    command:", "      - --entrypoints.web.forwardedHeaders.insecure=true"]],
    ["traefik/traefik.yml", ["entryPoints:", "  web:", "    forwardedHeaders:", "      insecure: true"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testSpoofableClientIpSkipsTrustedProxiesAndOtherReads(): void {
  const cases: Array<[string, string[]]> = [
    // A hop count or the proxies' own addresses.
    ["src/app.js", ["app.set('trust proxy', 1);", "app.set('trust proxy', 'loopback, 10.0.0.0/8');"]],
    ["deploy/nginx/site.conf", ["set_real_ip_from 10.0.0.0/8;", "# set_real_ip_from 0.0.0.0/0;"]],
    ["src/main/resources/application.properties", ["server.tomcat.remoteip.internal-proxies=10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"]],
    // The rightmost entry, which the trusted proxy added, and headers that are only forwarded or logged.
    ["src/ip.js", ["const ip = req.headers['x-forwarded-for'].split(',').pop().trim();"]],
    ["src/proxy.js", ["proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress);"]],
    ["src/log.js", ["logger.info({ forwardedFor: req.headers['x-forwarded-for'] });"]],
    // Behind a check that the request came through a trusted proxy.
    ["src/ip.js", ["if (trustedProxies.includes(req.socket.remoteAddress)) {", "  ip = req.headers['x-forwarded-for'].split(',')[0];", "}"]],
    // An option the operator sets, the header set on a forwarded request, and a walk from the right.
    ["src/express.js", ["if (config.get('usingLoopbackReverseProxy')) {", "  app.set('trust proxy', 'loopback');", "} else {", "  app.enable('trust proxy');", "}"]],
    ["src/server.js", ["if (options.trustProxy) {", "  app.set('trust proxy', true);", "}"]],
    ["src/ip.js", ["if (options.xForwardedFor) {", "  const forwarded = event.req.headers.get('x-forwarded-for')?.split(',')[0].trim();", "}"]],
    ["src/server.js", ["req.headers['x-forwarded-for'] ??= req.socket?.remoteAddress;"]],
    ["app/server.py", ["ip = headers.get('X-Forwarded-For', self.remote_ip)", "for ip in (cand.strip() for cand in reversed(ip.split(','))):", "    if ip not in trusted_downstream:", "        break"]],
    // Other `trustProxy` options and `insecure` settings.
    ["src/client.ts", ["const client = new Client({ trustProxy: true });"]],
    ["config/tls.yml", ["tls:", "  insecure: true"]],
    // Development setups and documentation.
    ["src/dev-server.js", ["app.set('trust proxy', true);"]],
    ["docs/proxies.md", ["app.set('trust proxy', true);"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testSpoofableClientIpSkipsTestsAndCanBeDisabled(): void {
  const lines = ["app.set('trust proxy', true);"];
  assert.deepEqual(findings([added("tests/server.test.js", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { spoofableClientIp: { enabled: false } } });
  assert.deepEqual(findings([added("src/app.js", lines)], config), []);
}
