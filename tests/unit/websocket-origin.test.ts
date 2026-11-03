import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { websocketOriginRule } from "../../src/rules/websocket-origin.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return websocketOriginRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testWebsocketOriginReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("internal/ws/handler.go", [
      "var upgrader = websocket.Upgrader{",
      "\tReadBufferSize: 1024,",
      "\tCheckOrigin: func(r *http.Request) bool {",
      "\t\t// allow every client",
      "\t\treturn true",
      "\t},",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "WebSocket accepts any origin");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 lets a WebSocket accept connections from any origin. Browsers send cookies with the handshake and CORS does not apply, so any site a signed-in user visits can open the socket as that user and read what it sends."
  );
}

export function testWebsocketOriginReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["server/ws.go", ["\tCheckOrigin: func(r *http.Request) bool { return true },"]],
    ["server/ws.go", ["opts := &websocket.AcceptOptions{InsecureSkipVerify: true}"]],
    ["src/main/java/app/WebSocketConfig.java", ["public void registerStompEndpoints(StompEndpointRegistry registry) {", "    registry.addEndpoint(\"/ws\").setAllowedOriginPatterns(\"*\").withSockJS();", "}"]],
    ["src/main/java/app/ChatConfigurator.java", ["public boolean checkOrigin(String originHeaderValue) { return true; }"]],
    ["src/server.js", ["const wss = new WebSocketServer({ server, verifyClient: () => true });"]],
    ["src/server.js", ["const wss = new WebSocket.Server({ port: 8080, verifyClient: (info, done) => done(true) });"]],
    ["project/asgi.py", ["application = ProtocolTypeRouter({", "    'http': get_asgi_application(),", "    'websocket': AuthMiddlewareStack(URLRouter(routes)),", "})"]],
    ["config/environments/production.rb", ["  config.action_cable.disable_request_forgery_protection = true"]],
    ["lib/app_web/endpoint.ex", ["  socket \"/live\", Phoenix.LiveView.Socket, websocket: [check_origin: false]"]],
    ["Program.cs", ["var options = new WebSocketOptions();", "options.AllowedOrigins.Add(\"*\");"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testWebsocketOriginSkipsOriginChecks(): void {
  const cases: Array<[string, string[]]> = [
    // A CheckOrigin that compares the origin, and the default.
    ["server/ws.go", ["\tCheckOrigin: func(r *http.Request) bool {", "\t\treturn allowed[r.Header.Get(\"Origin\")]", "\t},"]],
    ["server/ws.go", ["var upgrader = websocket.Upgrader{ReadBufferSize: 1024}"]],
    ["src/main/java/app/WebSocketConfig.java", ["registry.addEndpoint(\"/ws\").setAllowedOrigins(\"https://app.example.com\");"]],
    // Spring CORS outside WebSocket configuration is insecure-web-config's.
    ["src/main/java/app/WebConfig.java", ["registry.addMapping(\"/api/**\").setAllowedOrigins(\"*\");"]],
    ["src/server.js", ["const wss = new WebSocketServer({ server, verifyClient: ({ origin }) => allowed.has(origin) });"]],
    [
      "project/asgi.py",
      ["application = ProtocolTypeRouter({", "    'websocket': AllowedHostsOriginValidator(AuthMiddlewareStack(URLRouter(routes))),", "})"]
    ],
    ["config/environments/production.rb", ["  config.action_cable.allowed_request_origins = ['https://app.example.com']"]],
    // Development settings and comments.
    ["config/dev.exs", ["  check_origin: false,"]],
    ["config/environments/development.rb", ["  config.action_cable.disable_request_forgery_protection = true"]],
    ["server/ws.go", ["\t// CheckOrigin: func(r *http.Request) bool { return true },"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testWebsocketOriginSkipsTestsAndCanBeDisabled(): void {
  const line = "\tCheckOrigin: func(r *http.Request) bool { return true },";
  assert.deepEqual(findings([added("server/ws_test.go", [line]), added("testdata/ws.go", [line]), added("docs/ws.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { websocketOrigin: { enabled: false } } });
  assert.deepEqual(findings([added("server/ws.go", [line])], config), []);
}
