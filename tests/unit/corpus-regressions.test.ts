import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";

// Lines from popular open-source packages that rules used to report wrongly, and the closest
// lines that must still be reported. They were found by running every rule over the files of about
// forty npm, PyPI, and RubyGems packages as if a pull request added them.

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function ruleIds(path: string, lines: string[]): string[] {
  return analyzePullRequest([added(path, lines)], defaultConfig).findings.map((finding) => finding.ruleId);
}

export function testMinifiedBundlesAreNotReadAsWeakCrypto(): void {
  const bundle = `!function(e){var token=Math.random().toString(36);${"x".repeat(600)}}();`;
  assert.ok(!ruleIds("dist/socket.io.min.js", [bundle]).includes("weak-crypto"));
  assert.ok(!ruleIds("static/vendor.js", [bundle]).includes("weak-crypto"));
  assert.ok(ruleIds("src/reset.js", ["const resetToken = Math.random().toString(36);"]).includes("weak-crypto"));
}

export function testPythonNamesAreNotReadAsRailsInput(): void {
  // Django's login view assigns a variable named redirect_to; Ansible modules read `params[...]`.
  assert.ok(!ruleIds("django/contrib/auth/views.py", ["redirect_to = self.request.POST.get(self.redirect_field_name)"]).includes("untrusted-input"));
  assert.ok(!ruleIds("ansible/modules/copy.py", ["b_src = to_bytes(os.path.join(module.params['src'], ''))"]).includes("untrusted-input"));
  assert.ok(ruleIds("app/controllers/sessions_controller.rb", ["redirect_to params[:return_to]"]).includes("untrusted-input"));
}

export function testReadingTheUmaskIsNotReported(): void {
  // Setting the umask to read it, then restoring it, is the only way to read it in Python.
  assert.ok(!ruleIds("django/core/management/templates.py", ["current_umask = os.umask(0)"]).includes("file-permissions"));
  assert.ok(!ruleIds("lib/util.py", ["    return os.umask(0)"]).includes("file-permissions"));
  assert.ok(ruleIds("scripts/setup.py", ["os.umask(0)"]).includes("file-permissions"));
}

export function testExampleProjectsAreNotProductionSettings(): void {
  assert.ok(!ruleIds("examples/django/proj/settings.py", ["DEBUG = True"]).includes("insecure-web-config"));
  assert.ok(ruleIds("proj/settings.py", ["DEBUG = True"]).includes("insecure-web-config"));
}

export function testPublishConfigIsNotADependency(): void {
  const manifest = added("package.json", ['  "publishConfig": {', '    "tag": "latest",', '    "registry": "https://registry.npmjs.org/"', "  },"]);
  assert.deepEqual(dependencyChanges([manifest]), []);
}

export function testPopularPackagesNamedLikeOthersAreNotLookalikes(): void {
  const manifest = added("package.json", ['  "dependencies": {', '    "cookies": "~0.9.0",', '    "mquery": "5.0.0"', "  }"]);
  assert.ok(!analyzePullRequest([manifest], defaultConfig).findings.some((finding) => finding.ruleId === "lookalike-dependency"));
}

export function testTranslationCatalogsMayUseDirectionMarks(): void {
  const zeroWidthSpace = String.fromCodePoint(0x200b);
  const rightToLeftMark = String.fromCodePoint(0x202b);
  const catalog = [`msgstr "${rightToLeftMark}%(num)d ${zeroWidthSpace}"`];
  assert.ok(!ruleIds("locale/km/LC_MESSAGES/django.po", catalog).includes("hidden-unicode"));
  assert.ok(ruleIds("src/strings.ts", catalog).includes("hidden-unicode"));

  // Tag characters can spell out hidden instructions and are reported in translations too.
  const tags = [..."approve"].map((char) => String.fromCodePoint(0xe0000 + char.charCodeAt(0))).join("");
  assert.ok(ruleIds("locale/km/LC_MESSAGES/django.po", [`msgstr "ok${tags}"`]).includes("hidden-unicode"));
}

export function testMigrationOperationsCountOnlyAsCalls(): void {
  const framework = ["from .fields import AddField, AlterField, RemoveField, RenameField", "elif isinstance(operation, RemoveField):", "new CreateModel, and CreateModel and DeleteModel can be optimized into"];
  assert.ok(!ruleIds("django/db/migrations/operations/models.py", framework).includes("destructive-migration"));
  assert.ok(ruleIds("app/migrations/0002_remove_name.py", ["        migrations.RemoveField(", "            model_name='contenttype',"]).includes("destructive-migration"));
}

export function testActiveRecordLogNamesAreNotSql(): void {
  // The second argument of select_all is a name for the log, not SQL.
  assert.ok(!ruleIds("lib/active_record/querying.rb", ['connection.select_all(sanitize_sql(sql), "#{name} Load", binds)']).includes("sql-injection"));
  assert.ok(ruleIds("app/models/user.rb", ["User.where(\"email = '#{email}'\")"]).includes("sql-injection"));
}

export function testImportsDoNotTurnOffChecks(): void {
  assert.ok(!ruleIds("celery/backends/redis.py", ["from ssl import CERT_NONE, CERT_OPTIONAL, CERT_REQUIRED"]).includes("disabled-security-check"));
  assert.ok(ruleIds("app/client.py", ["context.verify_mode = ssl.CERT_NONE"]).includes("disabled-security-check"));
}
