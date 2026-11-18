import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { aiServiceExposureRule } from "../../src/rules/ai-service-exposure.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return aiServiceExposureRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testAiServiceExposureReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/docker-compose.yml", ["services:", "  open-webui:", "    image: ghcr.io/open-webui/open-webui:0.6.5", "    environment:", "      - WEBUI_AUTH=False", "      - OLLAMA_ORIGINS=*"])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "AI service open without a login");
  assert.deepEqual(finding?.lines, [5, 6]);
  assert.equal(
    finding?.message,
    "In lines 5, 6, the change turns Open WebUI's login off, so anyone who reaches it can use its models, tools, and stored chats and lets every website call Ollama's API from the user's browser."
  );
}

export function testAiServiceExposureReadsEachService(): void {
  const cases: Array<[string, string[], "high" | "warning"]> = [
    // Gradio share links, in code over several lines and from the web UIs' flags.
    ["app.py", ["demo.launch(", "    server_port=7860,", "    share=True,", ")"], "warning"],
    ["run.sh", ["python server.py --listen --share --model llama-3-8b"], "warning"],
    ["webui-user.sh", ["export COMMANDLINE_ARGS=\"--xformers --share\""], "warning"],
    // Open WebUI in Kubernetes and Pulumi.
    ["k8s/open-webui.yaml", ["        env:", "          - name: WEBUI_AUTH", "            value: \"false\""], "high"],
    ["infra/__main__.py", ["k8s.core.v1.EnvVarArgs(name=\"WEBUI_AUTH\", value=\"false\"),"], "high"],
    // Ollama and Ray on a host.
    ["deploy/ollama.service", ["[Service]", "Environment=\"OLLAMA_HOST=0.0.0.0:11434\"", "ExecStart=/usr/local/bin/ollama serve"], "warning"],
    ["scripts/start-head.sh", ["ray start --head --port=6379 --dashboard-host=0.0.0.0"], "high"],
    ["cluster/start.py", ["ray.init(", "    num_cpus=8,", "    dashboard_host=\"0.0.0.0\",", ")"], "warning"]
  ];
  for (const [path, lines, severity] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.equal(result[0]?.severity, severity, `${path}: ${lines.join(" | ")}`);
  }
}

export function testAiServiceExposureSkipsContainersAndAuthenticatedServices(): void {
  const cases: Array<[string, string[]]> = [
    // Share links with a login, and launches without a share link.
    ["app.py", ["demo.launch(share=True, auth=(\"admin\", os.environ[\"UI_PASSWORD\"]))"]],
    ["app.py", ["demo.launch(server_name=\"0.0.0.0\", server_port=7860)"]],
    ["run.sh", ["python server.py --share --gradio-auth-path /etc/webui/auth.txt"]],
    // Logins left on, and listed origins.
    ["deploy/docker-compose.yml", ["    environment:", "      - WEBUI_AUTH=True", "      - OLLAMA_ORIGINS=https://chat.acme.io"]],
    // Ollama and Ray bound to every interface inside containers, where ports and Services decide.
    ["deploy/docker-compose.yml", ["    environment:", "      - OLLAMA_HOST=0.0.0.0"]],
    ["Dockerfile", ["ENV OLLAMA_HOST=0.0.0.0:11434"]],
    ["k8s/ray-cluster.yaml", ["  headGroupSpec:", "    rayStartParams:", "      dashboard-host: \"0.0.0.0\""]],
    // Settings quoted in descriptions and messages.
    ["src/rules/ai.ts", ["  description: \"Flags Ollama's `OLLAMA_ORIGINS=*` and Open WebUI's `WEBUI_AUTH=False`.\","]],
    // Reading the setting, and comments.
    ["client.py", ["host = os.getenv(\"OLLAMA_HOST\", \"http://localhost:11434\")"]],
    ["app.py", ["# demo.launch(share=True)"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testAiServiceExposureSkipsTestsAndCanBeDisabled(): void {
  const lines = ["demo.launch(share=True)"];
  assert.deepEqual(findings([added("release/long_running_tests/app.py", lines)]), []);
  assert.deepEqual(findings([added("examples/chat/app.py", lines)]), []);
  assert.deepEqual(findings([added("docs/quickstart.py", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { aiServiceExposure: { enabled: false } } });
  assert.deepEqual(findings([added("app.py", lines)], config), []);
}
