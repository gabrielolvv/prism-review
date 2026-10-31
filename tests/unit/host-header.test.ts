import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { hostHeaderRule } from "../../src/rules/host-header.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return hostHeaderRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testHostHeaderReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/routes/password.js", [
      "router.post('/forgot-password', async (req, res) => {",
      "  const token = await createResetToken(req.body.email);",
      "  const link = `https://${req.headers.host}/reset?token=${token}`;",
      "  await sendMail(req.body.email, 'Reset your password', link);",
      "});"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Host header trusted");
  assert.deepEqual(finding?.lines, [3]);
  assert.equal(
    finding?.message,
    "Line 3 builds a link sent by email from the request's Host header. Whoever sends the request chooses that host, so a password reset or invite asked for in a victim's name can mail the victim a link to the attacker's site, carrying the victim's token."
  );
}

export function testHostHeaderReadsEachFramework(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    ["src/auth.ts", ["const url = `${req.protocol}://${req.get('host')}/verify-email/${code}`;"], "high"],
    ["src/invite.ts", ["const inviteUrl = new URL(`/invite/${id}`, `https://${req.headers['x-forwarded-host']}`);"], "high"],
    ["accounts/views.py", ["reset_url = f\"https://{request.META['HTTP_HOST']}/reset/{uid}/{token}/\"", "send_mail('Password reset', reset_url, None, [user.email])"], "high"],
    ["app/auth.py", ["link = request.host_url + url_for('confirm_email', token=token)"], "high"],
    ["app/Http/Controllers/PasswordController.php", ["$link = 'https://' . $_SERVER['HTTP_HOST'] . '/reset?token=' . $token;", "mail($email, 'Password reset', $link);"], "high"],
    ["src/PasswordReset.java", ["String link = \"https://\" + request.getHeader(\"Host\") + \"/reset?token=\" + token;", "mailer.send(email, link);"], "high"],
    ["reset.go", ["link := fmt.Sprintf(\"https://%s/reset?token=%s\", r.Host, token)", "sendResetEmail(user.Email, link)"], "high"],
    ["app/controllers/invites_controller.rb", ["invite_url = \"#{request.base_url}/invites/#{invite.token}\"", "InviteMailer.invite(invite_url).deliver_later"], "high"],
    ["project/settings.py", ["ALLOWED_HOSTS = ['*']"], "warning"],
    ["project/settings/production.py", ["ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')"], "warning"],
    ["config/environments/production.rb", ["  config.hosts.clear"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testHostHeaderSkipsSafeUses(): void {
  const cases: Array<[string, string[]]> = [
    // A configured base URL, and Django's checked get_host() and build_absolute_uri().
    ["src/routes/password.js", ["const link = `${process.env.APP_URL}/reset?token=${token}`;", "await sendMail(email, 'Reset your password', link);"]],
    ["accounts/views.py", ["reset_url = request.build_absolute_uri(reverse('reset', args=[uid, token]))", "send_mail('Password reset', reset_url, None, [user.email])"]],
    // The host outside an email flow, as logging, API mounts, and OAuth callbacks use it.
    ["src/server.js", ["const base = req.protocol + '://' + req.get('host') + mountPath;"]],
    ["src/oauth.js", ["const callbackUrl = `${req.protocol}://${req.get('host')}/callback`;", "const token = jwt.sign({ verifier: codeVerifier }, secret);"]],
    // Setting the Host of an outgoing request in Go.
    ["client.go", ["req.Host = r.URL.Host", "sendVerification(req)"]],
    ["project/settings.py", ["ALLOWED_HOSTS = ['example.com', '.example.com']"]],
    ["config/environments/production.rb", ["  config.hosts << 'example.com'"]],
    // Development settings and comments.
    ["project/settings/dev.py", ["ALLOWED_HOSTS = ['*']"]],
    ["config/environments/development.rb", ["  config.hosts.clear"]],
    ["src/routes/password.js", ["// const link = `https://${req.headers.host}/reset?token=${token}`;"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testHostHeaderSkipsTestsAndCanBeDisabled(): void {
  const line = "ALLOWED_HOSTS = ['*']";
  assert.deepEqual(findings([added("tests/settings.py", [line]), added("fixtures/settings.py", [line]), added("docs/settings.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { hostHeader: { enabled: false } } });
  assert.deepEqual(findings([added("project/settings.py", [line])], config), []);
}
