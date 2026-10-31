import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { unsafeReflectionRule } from "../../src/rules/unsafe-reflection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return unsafeReflectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUnsafeReflectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/controllers/exports_controller.rb", [
      "def create",
      "  exporter = params[:format].constantize.new",
      "  exporter.public_send(params[:method], current_user)",
      "end"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Code chosen by request input");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 load or call code by a name that comes from the request (constantize, send), so a request can pick any module, class, or method the process can reach, such as `eval`, `system`, or `constructor`."
  );
}

export function testUnsafeReflectionReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/plugins.js", ["const plugin = require(`./plugins/${req.query.name}`);"]],
    ["src/rest.js", ["const outputType = req.query.output || 'json';", "res[outputType](result);"]],
    ["src/log.ts", ["const { code, level } = req.body;", "logger[level](code);"]],
    ["app/views.py", ['module = importlib.import_module(request.GET["module"])']],
    ["app/views.py", ['action = request.args.get("action")', "return getattr(handlers, action)(request)"]],
    ["app/controllers/items_controller.rb", ["klass = Object.const_get(params[:type])"]],
    ["src/Dispatch.java", ['Class<?> type = Class.forName(request.getParameter("type"));']],
    ["Controllers/Dispatch.cs", ['var type = Type.GetType(Request.Query["type"]);']],
    ["src/dispatch.php", ["call_user_func($_GET['callback'], $data);"]],
    ["src/dispatch.php", ["$class = $_POST['class'];", "$handler = new $class();"]],
    ["handlers.go", ['m := reflect.ValueOf(h).MethodByName(r.FormValue("action"))']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnsafeReflectionSkipsFixedTablesAndAllowlists(): void {
  const cases: Array<[string, string[]]> = [
    // Names checked against a list, or looked up in a table of fixed functions.
    ["app/controllers/exports_controller.rb", ["if %w[CsvExporter PdfExporter].include?(params[:format])", "  exporter = params[:format].constantize.new"]],
    ["app/views.py", ['action = request.args.get("action")', "if action in ALLOWED_ACTIONS:", "    return getattr(handlers, action)(request)"]],
    ["src/convert.js", ["const { type } = req.query;", "if (!(type in converters)) throw new Error('bad type');", "value = converters[type](value);"]],
    ["src/users.js", ["const section = req.params.section;", "sectionToController[section](req, res, next);"]],
    ["src/dispatch.php", ["$f = $_GET['f'];", "if (in_array($f, $allowed, true)) { call_user_func($f); }"]],
    // Fixed names, and names after a fixed prefix.
    ["app/views.py", ['ordering = request.query_params.get("ordering")', "default = getattr(view, 'ordering', None)"]],
    ["app/wiki.py", ['action_name = request.args.get("action")', 'action = getattr(actions, f"on_{action_name}", None)']],
    // Code chosen by values that do not come from the request.
    ["src/plugins.js", ["const plugin = require(config.pluginPath);", "handlers[event.type](event);"]],
    ["src/plugins.js", ["// require(req.query.name)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUnsafeReflectionSkipsTestsAndCanBeDisabled(): void {
  const line = "const plugin = require(req.query.name);";
  assert.deepEqual(findings([added("src/plugins.test.js", [line]), added("fixtures/plugins.js", [line]), added("docs/plugins.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { unsafeReflection: { enabled: false } } });
  assert.deepEqual(findings([added("src/plugins.js", [line])], config), []);
}
