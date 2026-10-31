import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { regexInjectionRule } from "../../src/rules/regex-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return regexInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testRegexInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/routes/search.js", [
      "const { q } = req.query;",
      "const pattern = new RegExp(q, 'i');",
      "const users = await User.find({ name: { $regex: req.query.name, $options: 'i' } });"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Regular expression built from request input");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 compile regular expressions from a request value without escaping it, so a request can send a pattern such as `(a+)+$` that takes exponential time to fail (ReDoS), or `.*` that matches every record."
  );
}

export function testRegexInjectionReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/search.ts", ["const filter = RegExp(`^${req.query.prefix}`);"]],
    ["src/search.js", ["const term = req.body.term;", "items.filter((item) => new RegExp(term).test(item.name));"]],
    ["app/views.py", ['pattern = re.compile(request.args.get("q"), re.I)']],
    ["app/views.py", ['q = request.GET["q"]', "books = Book.objects.filter(title__iregex=q)"]],
    ["app/views.py", ['docs = db.items.find({"name": {"$regex": request.json["name"]}})']],
    ["app/controllers/search_controller.rb", ["matcher = Regexp.new(params[:q], Regexp::IGNORECASE)"]],
    ["app/controllers/search_controller.rb", ["@users = User.select { |u| u.name =~ /#{params[:q]}/i }"]],
    ["src/Search.java", ['String q = request.getParameter("q");', "Pattern pattern = Pattern.compile(q);"]],
    ["src/Search.java", ['if (name.matches(request.getParameter("pattern"))) {']],
    ["Controllers/Search.cs", ['if (Regex.IsMatch(name, Request.Query["q"])) {']],
    ["src/search.php", ["$found = preg_grep('/' . $_GET['q'] . '/', $names);"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testRegexInjectionSkipsEscapedAndFixedPatterns(): void {
  const cases: Array<[string, string[]]> = [
    // Escaped values match their own text.
    ["src/search.js", ["const pattern = new RegExp('^' + escapeRegExp(req.body.email) + '$', 'i');"]],
    ["src/search.js", ["const q = _.escapeRegExp(req.query.q);", "const pattern = new RegExp(q, 'i');"]],
    ["app/views.py", ['pattern = re.compile(re.escape(request.args["q"]))']],
    ["src/Search.java", ['Pattern pattern = Pattern.compile(Pattern.quote(request.getParameter("q")));']],
    ["Controllers/Search.cs", ['var regex = new Regex(Regex.Escape(Request.Query["q"]));']],
    ["src/search.php", ["preg_match('/' . preg_quote($_GET['q'], '/') . '/', $name);"]],
    ["app/controllers/search_controller.rb", ["matcher = Regexp.new(Regexp.escape(params[:q]))"]],
    // Fixed patterns, and request values matched against a fixed pattern.
    ["src/search.js", ["const valid = /^[a-z]+$/.test(req.query.name);", "const pattern = new RegExp('^v\\\\d+$');"]],
    ["app/views.py", ['if re.match(r"^[a-z]+$", request.args["name"]):']],
    ["Controllers/Search.cs", ['if (Regex.IsMatch(Request.Query["q"], "^[a-z]+$")) {']],
    // Other calls named like the sinks, and comments.
    ["src/search.js", ["const stream = storage.search(req.query.startkey || 0, { req });"]],
    ["src/search.js", ["// new RegExp(req.query.q)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testRegexInjectionSkipsTestsAndCanBeDisabled(): void {
  const line = "const pattern = new RegExp(req.query.q);";
  assert.deepEqual(findings([added("src/search.test.js", [line]), added("fixtures/search.js", [line]), added("docs/search.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { regexInjection: { enabled: false } } });
  assert.deepEqual(findings([added("src/search.js", [line])], config), []);
}
