import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { grpcPlaintextRule } from "../../src/rules/grpc-plaintext.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return grpcPlaintextRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testGrpcPlaintextReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/payments/client.py", [
      "import grpc",
      "",
      "channel = grpc.insecure_channel('payments.internal.example.com:443')",
      "stub = PaymentsStub(channel)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "gRPC without TLS");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 sets up a gRPC connection without TLS, so requests, responses, and the credentials in their metadata, such as bearer tokens and API keys, cross the network in plain text that anyone on the path can read or change."
  );
}

export function testGrpcPlaintextReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["app/server.py", ["server.add_insecure_port('[::]:50051')"]],
    ["app/client.py", ["async with grpc.aio.insecure_channel(settings.PAYMENTS_URL) as channel:"]],
    ["client/payments.go", ["conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))"]],
    ["client/payments.go", ["conn, err := grpc.Dial(\"payments:443\", grpc.WithInsecure())"]],
    ["src/main/java/app/PaymentsClient.java", ["ManagedChannel channel = ManagedChannelBuilder.forAddress(host, 443).usePlaintext().build();"]],
    ["src/clients/payments.ts", ["const client = new PaymentsClient(address, credentials.createInsecure());"]],
    ["src/server.js", ["server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), start);"]],
    ["Clients/Payments.cs", ["var channel = new Channel(host, ChannelCredentials.Insecure);"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testGrpcPlaintextSkipsLocalAndChosenPlaintext(): void {
  const cases: Array<[string, string[]]> = [
    // Local targets and in-process channels.
    ["app/client.py", ["channel = grpc.insecure_channel('localhost:50051')"]],
    ["client/sidecar.go", ["conn, err := grpc.Dial(\"unix:///var/run/agent.sock\", grpc.WithTransportCredentials(insecure.NewCredentials()))"]],
    ["src/main/java/app/Client.java", ["ManagedChannelBuilder.forAddress(\"localhost\", port).usePlaintext().build();"]],
    ["src/client.ts", ["const client = new Client(LOCAL_TARGET, credentials.createInsecure());"]],
    // Plaintext as an option or fallback next to TLS, as clients that offer both do.
    ["app/client.py", ["if use_tls:", "    channel = grpc.secure_channel(target, grpc.ssl_channel_credentials())", "else:", "    channel = grpc.insecure_channel(target)"]],
    ["src/client.ts", ["const creds = options.credentials ?? credentials.createInsecure();"]],
    ["src/client.js", ["switch (tlsMode) {", "  case 1:", "    this.creds = credentials.createSsl();", "    break;", "  default:", "    this.creds = credentials.createInsecure();", "}"]],
    // A library's own definitions, a call named inside a string, and imports.
    ["grpc/dialoptions.go", ["func WithInsecure() DialOption {", "\treturn newFuncDialOption(func(o *dialOptions) {", "\t\to.copts.TransportCredentials = insecure.NewCredentials()", "\t})", "}"]],
    ["grpc/clientconn.go", ["\terrNoTransportSecurity = errors.New(\"grpc: no transport security set (use grpc.WithTransportCredentials(insecure.NewCredentials()) explicitly)\")"]],
    ["client/conn.go", ["import \"google.golang.org/grpc/credentials/insecure\""]],
    // Benchmarks, examples, and comments.
    ["benchmark/client/main.go", ["conn, _ := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))"]],
    ["app/client.py", ["# channel = grpc.insecure_channel(target)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testGrpcPlaintextSkipsTestsAndCanBeDisabled(): void {
  const line = "channel = grpc.insecure_channel(target)";
  assert.deepEqual(findings([added("tests/test_client.py", [line]), added("fixtures/client.py", [line]), added("examples/client.py", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { grpcPlaintext: { enabled: false } } });
  assert.deepEqual(findings([added("app/client.py", [line])], config), []);
}
