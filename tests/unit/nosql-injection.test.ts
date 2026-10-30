import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { nosqlInjectionRule } from "../../src/rules/nosql-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return nosqlInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testNosqlInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/routes/auth.js", [
      "const user = await User.findOne({ email: req.body.email, password: req.body.password });",
      "const items = await Item.find({ $where: `this.owner == '${owner}'` });"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Request value in a MongoDB query");
  assert.deepEqual(finding?.lines, [1, 2]);
  assert.equal(
    finding?.message,
    'Lines 1, 2 put a value from the request into a MongoDB filter, where an object such as `{"$ne": null}` matches any document, and build a MongoDB `$where` expression from text, which runs as JavaScript on the database.'
  );
}

export function testNosqlInjectionReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    ["src/auth.js", ["const user = await User.findOne({", "  email: req.body.email,", "  password: req.body.password", "});"]],
    ["src/auth.js", ["const { email, password } = req.body;", "const user = await User.findOne({ email, password });"]],
    ["src/auth.js", ["const body = req.body;", "const user = await User.findOne({ email: body.email });"]],
    ["src/search.js", ["const items = await Item.find(req.query);"]],
    ["src/search.ts", ["const docs = await db.collection('users').find({ name: req.query.name }).toArray();"]],
    ["src/search.js", ["const docs = await coll.find({ owner: JSON.parse(req.query.owner) });"]],
    ["src/search.js", ["Item.find({ $where: \"this.owner == '\" + req.query.owner + \"'\" });"]],
    ["src/koa.js", ["const user = await User.findOne({ token: ctx.request.body.token });"]],
    ["app/auth.py", ['user = db.users.find_one({"email": request.json["email"], "password": request.json["password"]})']],
    ["app/auth.py", ["data = request.get_json()", 'user = db.users.find_one({"token": data["token"]})']],
    ["src/Auth.php", ["$user = $collection->findOne(['email' => $_POST['email'], 'password' => $_POST['password']]);"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testNosqlInjectionSkipsCastAndTextValues(): void {
  const cases: Array<[string, string[]]> = [
    // Casts, $eq, and values passed through a function first.
    ["src/auth.js", ["const user = await User.findOne({ email: String(req.body.email) });"]],
    ["src/auth.js", ["const user = await User.findOne({ email: { $eq: req.body.email } });"]],
    ["src/auth.js", ["const token = await tokens.findOne({ _id: self.apos.launder.string(req.body.token) });"]],
    ["app/auth.py", ['user = db.users.find_one({"email": str(request.json["email"])})']],
    ["src/Auth.php", ["$user = $collection->findOne(['email' => (string) $_POST['email']]);"]],
    // Values that are always text: route parameters and Flask's query string.
    ["src/auth.js", ["const user = await User.findOne({ _id: req.params.id });"]],
    ["app/auth.py", ['user = db.users.find_one({"email": request.args.get("email")})']],
    // Calls that are not filters, and filters from elsewhere.
    ["src/auth.js", ["const user = await User.findById(req.body.id);"]],
    ["src/auth.js", ["const item = items.find((item) => item.id === req.body.id);"]],
    ["src/search.js", ["const items = await Item.find({ owner: req.user.id });"]],
    ["src/search.js", ["const { page } = req.query;", "const items = await Item.find({ owner: userId }).skip(page);"]],
    ["src/search.js", ["Item.find({ $where: 'this.a > this.b' });"]],
    // Comments.
    ["src/auth.js", ["// User.findOne({ email: req.body.email })"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testNosqlInjectionSkipsTestsAndOtherFiles(): void {
  const line = "User.findOne({ email: req.body.email });";

  assert.deepEqual(
    findings([added("src/auth.test.js", [line]), added("fixtures/auth.js", [line]), added("docs/auth.md", [line]), added("src/auth.d.ts", [line])]),
    []
  );
}

export function testNosqlInjectionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { nosqlInjection: { enabled: false } } });

  assert.deepEqual(findings([added("src/auth.js", ["User.findOne({ email: req.body.email });"])], config), []);
}
