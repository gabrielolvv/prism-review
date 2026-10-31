import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { commandInjectionRule } from "../../src/rules/command-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return commandInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testCommandInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/routes/ping.js", [
      "const { host } = req.query;",
      "exec(`ping -c 1 ${host}`, (error, stdout) => res.send(stdout));",
      "execSync('nslookup ' + req.body.domain);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Command built from request input");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 run commands with a value from the request in the program or the text a shell parses, so a request can add `; rm -rf /`, `$(curl ...)`, or another program and run it on the server."
  );
}

export function testCommandInjectionReadsEachLanguage(): void {
  const cases: Array<[string, string[]]> = [
    ["src/convert.ts", ["child_process.execSync(`convert ${req.params.file} out.png`);"]],
    ["src/run.js", ["const tool = req.query.tool;", "spawn(tool, ['--version']);"]],
    ["app/views.py", ['os.system("ping -c 1 " + request.args["host"])']],
    ["app/views.py", ['host = request.form["host"]', 'out = subprocess.check_output(f"dig {host}", shell=True)']],
    ["app/views.py", ['subprocess.run(request.json["command"])']],
    ["app/controllers/tools_controller.rb", ['system("convert #{params[:file]} out.png")']],
    ["app/controllers/tools_controller.rb", ["output = `whois #{params[:domain]}`"]],
    ["src/ping.php", ["$output = shell_exec('ping -c 1 ' . $_GET['host']);"]],
    ["src/ping.php", ["$output = `ping -c 1 {$_GET['host']}`;"]],
    ["src/Ping.java", ['Process p = Runtime.getRuntime().exec("ping -c 1 " + request.getParameter("host"));']],
    ["ping.go", ['out, _ := exec.Command("sh", "-c", "ping -c 1 "+r.FormValue("host")).Output()']],
    ["Controllers/Ping.cs", ['Process.Start("cmd.exe", "/c ping " + Request.Query["host"]);']]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testCommandInjectionSkipsArgumentsAndQuotedValues(): void {
  const cases: Array<[string, string[]]> = [
    // A fixed program with the request value as a separate argument and no shell.
    ["src/run.js", ["execFile('git', ['log', req.query.ref], callback);"]],
    ["app/views.py", ['subprocess.run(["git", "log", request.args["ref"]])']],
    ["app/controllers/tools_controller.rb", ['system("git", "log", params[:ref])']],
    ["ping.go", ['out, _ := exec.Command("ping", "-c", "1", r.FormValue("host")).Output()']],
    // Values quoted for a shell, or turned into numbers.
    ["app/views.py", ['os.system("ping -c 1 " + shlex.quote(request.args["host"]))']],
    ["src/ping.php", ["$output = shell_exec('ping -c 1 ' . escapeshellarg($_GET['host']));"]],
    ["app/controllers/tools_controller.rb", ['system("whois #{Shellwords.escape(params[:domain])}")']],
    ["src/run.js", ["execSync(`kill ${parseInt(req.params.pid, 10)}`);"]],
    // Commands from elsewhere, other methods named exec, and comments.
    ["src/run.js", ["execSync(`git log ${branch}`);", "const match = pattern.exec(req.query.q);"]],
    ["app/views.py", ["# os.system(request.args['cmd'])"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testCommandInjectionSkipsTestsAndCanBeDisabled(): void {
  const line = "execSync('ping ' + req.query.host);";
  assert.deepEqual(findings([added("src/ping.test.js", [line]), added("fixtures/ping.js", [line]), added("docs/ping.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { commandInjection: { enabled: false } } });
  assert.deepEqual(findings([added("src/ping.js", [line])], config), []);
}
