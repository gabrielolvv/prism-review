import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { requestSizeLimitRule } from "../../src/rules/request-size-limit.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return requestSizeLimitRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testRequestSizeLimitReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/app.js", [
      "app.use(express.json({ limit: '1gb' }));",
      "app.use(express.urlencoded({ extended: true, limit: '50mb' }));",
      "app.use(bodyParser.text({ limit: Infinity }));"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Request size limit lifted");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 turn off or raise the limit on how large a request body can be, so a few large requests can fill the server's memory or keep it busy parsing, and take the service down for everyone."
  );
}

export function testRequestSizeLimitReadsEachServer(): void {
  const cases: Array<[string, string[]]> = [
    ["src/app.ts", ["app.use(bodyParser.json({ limit: '500mb' }));"]],
    ["src/server.ts", ["const app = Fastify({ bodyLimit: 1024 * 1024 * 1024 });"]],
    ["src/server.ts", ["const app = fastify({ logger: true, bodyLimit: Number.MAX_SAFE_INTEGER });"]],
    ["src/app.js", ["app.use(koaBody({ jsonLimit: '2gb' }));"]],
    ["src/upload.js", ["const upload = multer({ storage, limits: { fileSize: Infinity } });"]],
    ["deploy/nginx.conf", ["    client_max_body_size 0;"]],
    ["project/settings.py", ["DATA_UPLOAD_MAX_MEMORY_SIZE = None"]],
    ["src/main/resources/application.properties", ["spring.servlet.multipart.max-file-size=-1"]],
    ["src/main/resources/application.yml", ["      max-request-size: -1"]],
    ["Controllers/UploadController.cs", ["    [DisableRequestSizeLimit]"]],
    ["Program.cs", ["builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = null);"]],
    ["docker/php.ini", ["post_max_size = 0"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testRequestSizeLimitSkipsBoundedLimits(): void {
  const cases: Array<[string, string[]]> = [
    // Limits under 100 MB, as Ghost's JSON APIs use, and the defaults.
    ["src/app.js", ["app.use(bodyParser.json({ limit: '50mb' }));", "app.use(express.json());", "app.use(express.urlencoded({ extended: true, limit: '10kb' }));"]],
    ["src/server.ts", ["const app = Fastify({ bodyLimit: 10 * 1024 * 1024 });"]],
    // Raw bodies and uploads with a size, and a limit read from configuration.
    ["src/upload.js", ["app.use(express.raw({ limit: '2gb' }));", "const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });"]],
    ["src/app.js", ["app.use(express.json({ limit: config.bodyLimit }));"]],
    ["deploy/nginx.conf", ["    client_max_body_size 10m;"]],
    ["project/settings.py", ["DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024"]],
    ["src/main/resources/application.properties", ["spring.servlet.multipart.max-file-size=10MB"]],
    ["Controllers/UploadController.cs", ["    [RequestSizeLimit(100_000_000)]"]],
    // Development settings and comments.
    ["project/settings/dev.py", ["DATA_UPLOAD_MAX_MEMORY_SIZE = None"]],
    ["src/app.js", ["// app.use(express.json({ limit: '1gb' }));"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testRequestSizeLimitSkipsTestsAndCanBeDisabled(): void {
  const line = "app.use(express.json({ limit: '1gb' }));";
  assert.deepEqual(findings([added("src/app.test.js", [line]), added("fixtures/app.js", [line]), added("docs/limits.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { requestSizeLimit: { enabled: false } } });
  assert.deepEqual(findings([added("src/app.js", [line])], config), []);
}
