import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { reflectedXssRule } from "../../src/rules/reflected-xss.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return reflectedXssRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testReflectedXssReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/app.js", [
      "app.get('/hello', (req, res) => res.send(`<h1>Hello ${req.query.name}</h1>`));",
      "app.get('/search', (req, res) => {",
      "  const { q } = req.query;",
      "  res.send('No results for ' + q);",
      "});"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Request value written into an HTML response");
  assert.deepEqual(finding?.lines, [1, 4]);
  assert.equal(
    finding?.message,
    "Lines 1, 4 write values from the request straight into an HTML response, so a link with `<script>` in it runs that script for whoever opens it (reflected cross-site scripting)."
  );
}

export function testReflectedXssReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/app.ts", ["res.write(req.body.comment);"]],
    ["app/views.py", ["@app.route('/hello')", "def hello():", "    name = request.args.get('name')", "    return f'<h1>Hello {name}</h1>'"]],
    ["app/views.py", ["@app.route('/search')", "def search():", "    return 'No results for ' + request.args['q']"]],
    ["app/views.py", ["def search(request):", "    return HttpResponse('No results for ' + request.GET['q'])"]],
    ["src/search.php", ["echo 'No results for ' . $_GET['q'];"]],
    ["src/search.php", ["<p>You searched for <?= $_GET['q'] ?></p>"]],
    ["src/form.php", ["<form action=\"<?php echo $_SERVER['PHP_SELF']; ?>\">"]],
    ["internal/handlers.go", ['fmt.Fprintf(w, "<h1>Hello %s</h1>", r.URL.Query().Get("name"))']],
    ["src/main/java/Hello.java", ['response.getWriter().println("<h1>Hello " + request.getParameter("name") + "</h1>");']],
    ["web/search.jsp", ['<% out.println(request.getParameter("q")); %>']],
    ["Controllers/Search.cs", ['await context.Response.WriteAsync("No results for " + context.Request.Query["q"]);']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testReflectedXssSkipsEscapedAndNonHtmlResponses(): void {
  const cases: Array<[string, string[]]> = [
    // Escaped values and templates.
    ["src/app.js", ["res.send(`<h1>Hello ${escapeHtml(req.query.name)}</h1>`);"]],
    ["src/app.js", ["res.render('search', { q: req.query.q });"]],
    ["app/views.py", ["@app.route('/hello')", "def hello():", "    return f'<h1>Hello {escape(request.args[\"name\"])}</h1>'"]],
    ["app/views.py", ["@app.route('/page')", "def page():", "    return Response(render_template('page.html', q=request.args['q']))"]],
    ["src/search.php", ["echo 'No results for ' . htmlspecialchars($_GET['q'], ENT_QUOTES);"]],
    ["internal/handlers.go", ['fmt.Fprintf(w, "<h1>Hello %s</h1>", html.EscapeString(r.URL.Query().Get("name")))']],
    ["src/main/java/Hello.java", ['response.getWriter().println(Encode.forHtml(request.getParameter("name")));']],
    ["Controllers/Search.cs", ['await context.Response.WriteAsync(HtmlEncoder.Default.Encode(context.Request.Query["q"]));']],
    // JSON and plain text.
    ["src/app.js", ["res.json({ q: req.query.q });"]],
    ["src/app.js", ["res.type('text').send(req.query.q);"]],
    ["app/views.py", ["@app.route('/api')", "def api():", "    return jsonify(q=request.args['q'])"]],
    ["app/views.py", ["@app.route('/api')", "def api():", "    q = request.args['q']", "    return {'q': q}"]],
    ["app/views.py", ["def search(request):", "    return HttpResponse(request.GET['q'], content_type='text/plain')"]],
    ["src/search.php", ["echo json_encode(['q' => $_GET['q']]);"]],
    // Returns outside a route, results of calls that receive the request, and comments.
    ["app/util.py", ["def page_number():", "    return request.args.get('page', 1)"]],
    ["app/views.py", ["def create(request):", "    serializer = self.get_serializer(data=request.data)", "    return Response(serializer.data)"]],
    ["src/app.js", ["// res.send(req.query.q);"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testReflectedXssSkipsTestsAndDocs(): void {
  const line = "res.send(req.query.q);";

  assert.deepEqual(findings([added("src/app.test.js", [line]), added("fixtures/app.js", [line]), added("docs/app.md", [line])]), []);
}

export function testReflectedXssCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { reflectedXss: { enabled: false } } });

  assert.deepEqual(findings([added("src/app.js", ["res.send(req.query.q);"])], config), []);
}
