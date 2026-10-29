import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { untrustedInputRule } from "../../src/rules/untrusted-input.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return untrustedInputRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUntrustedInputReportsEachKind(): void {
  const [finding] = findings([
    added("src/routes.ts", [
      "app.get('/login', (req, res) => res.redirect(req.query.next));",
      "const page = await fetch(req.body.url);",
      "res.sendFile(path.join(__dirname, 'uploads', req.params.name));"
    ])
  ]);

  assert.equal(finding?.severity, "warning");
  assert.deepEqual(finding?.lines, [1, 2, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 2, 3 pass a value from the request straight to code that redirects to a URL from the request, which can send users to any site, requests a URL from the request, which can reach internal services, and reads or writes a file path from the request, which can leave the intended directory."
  );
}

export function testUntrustedInputReadsOtherFrameworks(): void {
  const cases: Array<[string, string]> = [
    ["app/views.py", "return redirect(request.args.get('next'))"],
    ["app/views.py", "resp = requests.get(request.GET['url'], timeout=5)"],
    ["app/views.py", "with open(os.path.join(UPLOADS, request.form['file'])) as f:"],
    ["public/index.php", 'header("Location: " . $_GET["to"]);'],
    ["public/view.php", "include $_GET['page'] . '.php';"],
    ["handlers/proxy.go", 'resp, err := http.Get(r.URL.Query().Get("target"))'],
    ["handlers/files.go", 'f, err := os.Open(filepath.Join(root, r.FormValue("name")))'],
    ["app/controllers/sessions_controller.rb", "redirect_to params[:return_to]"],
    ["Controllers/Proxy.cs", 'var body = await client.GetStringAsync(Request.Query["url"]);']
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testUntrustedInputSkipsFixedTargetsAndGuards(): void {
  const safe = [
    // Fixed paths and hosts, where the request only fills in the rest.
    "res.redirect(`/users/${req.params.id}`);",
    "const user = await fetch(`https://api.example.com/users/${req.params.id}`);",
    'const data = await fetch(`/api/search?q=${searchParams.get("q")}`);',
    // Values reduced or checked on the same line.
    "res.sendFile(path.join(UPLOADS, path.basename(req.params.name)));",
    "f = open(os.path.join(UPLOADS, secure_filename(request.files['doc'].filename)))",
    "if url_has_allowed_host_and_scheme(request.GET['next'], allowed_hosts): return redirect(request.GET['next'])",
    // A sink without request input, and request input without a sink.
    "res.redirect(config.homeUrl);",
    "const limit = Number(req.query.limit ?? 20);",
    "// res.redirect(req.query.next)"
  ];
  assert.deepEqual(findings([added("src/routes.ts", safe)]), []);

  // `/${...}` is not a fixed path: it can become `//evil.example`.
  assert.equal(findings([added("src/routes.ts", ["res.redirect(`/${req.query.next}`);"])]).length, 1);

  const lines = ["res.redirect(req.query.next);"];
  assert.deepEqual(findings([added("docs/routing.md", lines)]), []);
  assert.deepEqual(findings([added("tests/routes.test.ts", lines)]), []);
  assert.deepEqual(findings([added("src/a.ts", lines)], prismConfigSchema.parse({ rules: { untrustedInput: { enabled: false } } })), []);
}
