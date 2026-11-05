import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { staticRootExposureRule } from "../../src/rules/static-root-exposure.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return staticRootExposureRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testStaticRootExposureReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("server.js", [
      "const app = express();",
      "app.use(express.static(__dirname));",
      "app.use('/assets', express.static(path.join(__dirname, 'public')));",
      "app.use('/files', express.static('.'));"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Project folder served as static files");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 serve the project's own folder as static files, so anyone can download the source code, `.env` files and other settings with their secrets, and the `.git` folder with the whole history."
  );
}

export function testStaticRootExposureReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/server.ts", ["app.use(serveStatic(process.cwd(), { index: false }));"]],
    ["src/server.ts", ["app.use(sirv(path.resolve(__dirname, '..')));"]],
    ["src/server.ts", ["import fastifyStatic from '@fastify/static';", "app.register(fastifyStatic, { root: __dirname });"]],
    ["app/__init__.py", ["app = Flask(__name__, static_folder='.', static_url_path='')"]],
    ["app/main.py", ["app.mount('/', StaticFiles(directory='.'), name='static')"]],
    ["project/urls.py", ["    re_path(r'^(?P<path>.*)$', serve, {'document_root': settings.BASE_DIR}),"]],
    ["app/server.py", ["app.router.add_static('/', os.path.dirname(__file__))"]],
    ["cmd/server/main.go", ["\thttp.Handle(\"/\", http.FileServer(http.Dir(\".\")))"]],
    ["cmd/server/main.go", ["\tr.Static(\"/\", \"./\")"]],
    ["app.rb", ["set :public_folder, __dir__"]],
    ["src/main/resources/application.properties", ["spring.web.resources.static-locations=classpath:/"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testStaticRootExposureSkipsPublicFolders(): void {
  const cases: Array<[string, string[]]> = [
    // Public folders by their full path.
    ["server.js", ["app.use(express.static(path.join(__dirname, 'public')));", "app.use(express.static('dist'));", "app.use(express.static('./build'));"]],
    ["app/__init__.py", ["app = Flask(__name__, static_folder='static')", "app.mount('/static', StaticFiles(directory='static'))"]],
    ["cmd/server/main.go", ["\thttp.Handle(\"/\", http.FileServer(http.Dir(\"./public\")))"]],
    ["app.rb", ["set :public_folder, File.dirname(__FILE__) + '/public'"]],
    ["src/main/resources/application.properties", ["spring.web.resources.static-locations=classpath:/static/,classpath:/public/"]],
    // `root` options of other packages, and development only.
    ["src/config.ts", ["const options = { root: __dirname };"]],
    ["server.js", ["if (process.env.NODE_ENV === 'development') {", "  app.use(express.static(__dirname));", "}"]],
    // Development servers, examples, and documentation.
    ["dev-server.js", ["app.use(express.static(__dirname));"]],
    ["examples/static/server.js", ["app.use(express.static(__dirname));"]],
    ["README.md", ["app.use(express.static(__dirname));"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testStaticRootExposureSkipsTestsAndCanBeDisabled(): void {
  const lines = ["app.use(express.static(__dirname));"];
  assert.deepEqual(findings([added("test/server.test.js", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { staticRootExposure: { enabled: false } } });
  assert.deepEqual(findings([added("server.js", lines)], config), []);
}
