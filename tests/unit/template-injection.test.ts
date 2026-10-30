import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { templateInjectionRule } from "../../src/rules/template-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return templateInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testTemplateInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/views.py", [
      "name = request.args.get('name')",
      "page = render_template_string('<h1>Hello ' + name + '</h1>')",
      "other = render_template_string(request.form['body'])"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Template built from request input");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 compile templates from text that comes from the request (render_template_string), so a request can write template code, such as `{{ ... }}`, that runs on the server."
  );
}

export function testTemplateInjectionReadsEachEngine(): void {
  const cases: Array<[string, string[]]> = [
    ["app/views.py", ["name = request.args.get('name')", "html = f'<h1>Hello {name}</h1>'", "return render_template_string(html)"]],
    ["app/views.py", ["t = jinja2.Template(request.form['body'])"]],
    ["app/views.py", ["tmpl = env.from_string(request.json['template'])"]],
    ["src/routes.js", ["res.send(ejs.render(req.body.template, { user }));"]],
    ["src/routes.js", ["const { template } = req.body;", "const fn = Handlebars.compile(template);"]],
    ["src/routes.js", ["const html = pug.render(`p Hello ${req.query.name}`);"]],
    ["src/routes.js", ["const out = nunjucks.renderString(req.query.tpl, ctx);"]],
    ["app/controllers/pages_controller.rb", ["render inline: params[:template]"]],
    ["app/controllers/pages_controller.rb", ["body = ERB.new(params[:body]).result(binding)"]],
    ["src/Page.php", ["$template = $twig->createTemplate($_POST['template']);"]],
    ["src/main/java/Page.java", ['String body = request.getParameter("body");', 'Velocity.evaluate(context, writer, "page", body);']],
    ["internal/page.go", ['t, _ := template.New("page").Parse(r.FormValue("tpl"))']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testTemplateInjectionSkipsRequestValuesPassedAsVariables(): void {
  const cases: Array<[string, string[]]> = [
    // The request only fills in variables of a fixed template.
    ["app/views.py", ["return render_template_string(PAGE, name=request.args.get('name'))"]],
    ["app/views.py", ["return render_template_string(open(path).read(), name=request.args['n'])"]],
    ["app/views.py", ["return render_template('page.html', name=request.args.get('name'))"]],
    ["src/routes.js", ["res.send(ejs.render(template, { name: req.query.name }));"]],
    ["app/controllers/pages_controller.rb", ["render inline: '<%= @name %>', locals: { name: params[:name] }"]],
    // Templates from files or fixed text, and string.Template, which runs no code.
    ["src/routes.js", ["const fn = Handlebars.compile(fs.readFileSync('page.hbs', 'utf8'));"]],
    ["app/views.py", ["name = 'world'", "return render_template_string('<h1>' + name + '</h1>')"]],
    ["app/views.py", ["t = string.Template(request.args['t'])"]],
    ["src/main/java/Page.java", ['Velocity.evaluate(context, writer, "page", TEMPLATE);']],
    ["internal/page.go", ['t := template.Must(template.New("page").Parse(pageHTML))']],
    // A name reassigned from something else, and comments.
    ["app/views.py", ["body = request.form['body']", "body = load_template('page')", "return render_template_string(body)"]],
    ["app/views.py", ["# render_template_string(request.args['t'])"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testTemplateInjectionSkipsTestsAndDocs(): void {
  const line = "render_template_string(request.args['t'])";

  assert.deepEqual(findings([added("tests/test_views.py", [line]), added("fixtures/views.py", [line]), added("docs/views.md", [line])]), []);
}

export function testTemplateInjectionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { templateInjection: { enabled: false } } });

  assert.deepEqual(findings([added("app/views.py", ["render_template_string(request.args['t'])"])], config), []);
}
