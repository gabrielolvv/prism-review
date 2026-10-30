import assert from "node:assert/strict";
import type { ChangedFile, FileStatus } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { adminRouteAuthRule } from "../../src/rules/admin-route-auth.js";

function changed(path: string, lines: string[], status: FileStatus = "added"): ChangedFile {
  return { path, status, additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return adminRouteAuthRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testAdminRouteAuthReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    changed("src/routes/admin.js", [
      "const router = express.Router();",
      "router.delete('/admin/users/:id', async (req, res) => {",
      "  await User.deleteOne({ _id: req.params.id });",
      "  res.sendStatus(204);",
      "});",
      "router.post('/internal/cache/flush', flushCache);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Admin route without an access check");
  assert.deepEqual(finding?.lines, [2, 6]);
  assert.equal(
    finding?.message,
    "Lines 2, 6 register admin or internal routes with no authentication or role check in sight, so anyone who finds the URL can use them."
  );
}

export function testAdminRouteAuthReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["src/server.js", ["app.get('/internal/metrics/dump', dumpMetrics);"]],
    ["app/admin.py", ["@app.route('/admin/users/<int:id>/delete', methods=['POST'])", "def delete_user(id):", "    User.query.filter_by(id=id).delete()", "    return redirect('/admin')"]],
    ["internal/routes.go", ['r.POST("/admin/reset", resetAll)']],
    ["routes/web.php", ["Route::post('/admin/users/{id}/ban', [AdminController::class, 'ban']);"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([changed(path, lines)]).length, 1, `${path}: ${lines[0]}`);
  }
}

export function testAdminRouteAuthReportsUnguardedRoutesNextToGuardedOnes(): void {
  // In a changed file, protection may sit outside the patch, unless the patch shows a guarded route.
  const lines = ["router.get('/admin/stats', requireAdmin, stats);", "router.delete('/admin/users/:id', deleteUser);"];

  assert.deepEqual(findings([changed("src/routes/admin.js", lines, "modified")])[0]?.lines, [2]);
  assert.deepEqual(findings([changed("src/routes/admin.js", ["router.delete('/admin/users/:id', deleteUser);"], "modified")]), []);
}

export function testAdminRouteAuthSkipsGuardedRoutes(): void {
  const cases: Array<[string, string[]]> = [
    ["src/routes/admin.js", ["router.delete('/admin/users/:id', requireAdmin, async (req, res) => {", "  res.sendStatus(204);", "});"]],
    ["src/routes/admin.js", ["router.use(authenticate);", "router.delete('/admin/users/:id', deleteUser);"]],
    ["src/routes/admin.js", ["router.get('/admin/stats', async (req, res) => {", "  if (!req.user?.isAdmin) return res.status(403).end();", "  res.json(stats);", "});"]],
    ["src/server.js", ["app.use('/admin', passport.authenticate('jwt'), adminRouter);", "app.get('/admin/stats', stats);"]],
    ["app/admin.py", ["@app.route('/admin/users')", "@login_required", "def users():", "    return render_template('users.html')"]],
    [
      "app/admin.py",
      ["@bp.before_request", "def check_admin():", "    if not current_user.is_admin: abort(403)", "@bp.route('/admin/users')", "def users():", "    return 'x'"]
    ],
    ["internal/routes.go", ['admin := r.Group("/admin", AuthRequired())', 'admin.POST("/admin/reset", resetAll)']],
    ["internal/routes.go", ['http.HandleFunc("/admin/reset", requireAdmin(resetAll))']],
    [
      "routes/web.php",
      ["Route::middleware(['auth', 'can:admin'])->group(function () {", "    Route::post('/admin/users/{id}/ban', [AdminController::class, 'ban']);", "});"]
    ],
    ["routes/web.php", ["Route::post('/admin/users/{id}/ban', [AdminController::class, 'ban'])->middleware('auth');"]],
    // Paths that are not for administration.
    ["src/server.js", ["app.get('/users/:id', getUser);"]],
    ["src/server.js", ["app.get('/admin.css', sendStylesheet);"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([changed(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testAdminRouteAuthSkipsTestsAndCanBeDisabled(): void {
  const lines = ["router.delete('/admin/users/:id', deleteUser);"];
  const config = prismConfigSchema.parse({ rules: { adminRouteAuth: { enabled: false } } });

  assert.deepEqual(findings([changed("src/routes/admin.test.js", lines), changed("fixtures/routes.js", lines)]), []);
  assert.deepEqual(findings([changed("src/routes/admin.js", lines)], config), []);
}
