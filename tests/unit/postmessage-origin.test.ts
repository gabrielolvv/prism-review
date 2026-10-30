import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { postMessageOriginRule } from "../../src/rules/postmessage-origin.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return postMessageOriginRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPostMessageOriginReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/embed.js", [
      "window.parent.postMessage({ type: 'auth', token }, '*');",
      "window.addEventListener('message', (event) => {",
      "  setToken(event.data.token);",
      "});"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Cross-window message without an origin check");
  assert.deepEqual(finding?.lines, [1, 2]);
  assert.equal(
    finding?.message,
    "Lines 1, 2 send a message to any origin with `*`, so the data reaches whatever page is loaded in that window, and listen for messages from other windows without checking `event.origin`, so any website that can open or frame this page can send it commands."
  );
}

export function testPostMessageOriginReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    ["src/embed.ts", ['iframe.contentWindow.postMessage(payload, "*");']],
    ["src/popup.js", ["window.opener.postMessage({ code }, { targetOrigin: '*' });"]],
    ["src/app.js", ["window.onmessage = function (e) {", "  render(e.data);", "};"]],
    ["src/app.ts", ["window.addEventListener('message', handleMessage);", "", "function handleMessage(event: MessageEvent) {", "  router.push(event.data.url);", "}"]],
    [
      "src/App.vue",
      ["  mounted() {", "    window.addEventListener('message', this.onMessage);", "  },", "  methods: {", "    onMessage(e) {", "      this.user = e.data.user;", "    }"]
    ]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines[0]}`);
  }
}

export function testPostMessageOriginSkipsCheckedAndOtherMessages(): void {
  const cases: Array<[string, string[]]> = [
    // An exact target origin, or a window posting to itself.
    ["src/embed.js", ["window.parent.postMessage({ type: 'resize' }, 'https://app.example.com');"]],
    ["src/polyfill.js", ["window.postMessage(token, '*');"]],
    // Handlers that check the sender, directly or through a helper.
    ["src/app.js", ["window.addEventListener('message', (event) => {", "  if (event.origin !== 'https://app.example.com') return;", "});"]],
    ["src/app.js", ["window.addEventListener('message', ({ origin, data }) => {", "  if (!allowed.has(origin)) return;", "});"]],
    ["src/app.js", ["window.addEventListener('message', (event) => {", "  if (iframe.contentWindow !== event.source) return;", "});"]],
    ["src/app.js", ["window.addEventListener('message', (e) => {", "  if (!sanitize(e, childOrigin)) return;", "});"]],
    ["src/app.js", ["const onMessage = (event) => {", "  if (event.origin !== expected) return;", "};", "window.addEventListener('message', onMessage);"]],
    // A named handler defined outside the patch.
    ["src/app.ts", ["window.addEventListener('message', handleMessage);"]],
    // Workers, ports, and sockets.
    ["src/worker-client.js", ["worker.postMessage(buffer, [buffer]);"]],
    ["src/search.worker.js", ["addEventListener('message', (e) => {", "  postMessage(search(e.data));", "});"]],
    ["src/socket.js", ["socket.addEventListener('message', (e) => render(JSON.parse(e.data)));"]],
    ["src/channel.js", ["port.onmessage = (e) => update(e.data);"]],
    // Comments.
    ["src/app.js", ["// window.parent.postMessage(x, '*');"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines[0]}`);
  }
}

export function testPostMessageOriginSkipsTestsAndServerFiles(): void {
  const line = "window.parent.postMessage(x, '*');";

  assert.deepEqual(
    findings([added("src/embed.test.js", [line]), added("fixtures/embed.js", [line]), added("app/embed.py", [line]), added("dist/embed.min.js", [line])]),
    []
  );
}

export function testPostMessageOriginCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { postMessageOrigin: { enabled: false } } });

  assert.deepEqual(findings([added("src/embed.js", ["window.parent.postMessage(x, '*');"])], config), []);
}
