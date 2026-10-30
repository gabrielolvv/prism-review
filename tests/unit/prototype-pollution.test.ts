import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { prototypePollutionRule } from "../../src/rules/prototype-pollution.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return prototypePollutionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

const unguardedMerge = [
  "function merge(target, source) {",
  "  for (const key in source) {",
  "    if (typeof source[key] === 'object') {",
  "      target[key] = merge(target[key] || {}, source[key]);",
  "    } else {",
  "      target[key] = source[key];",
  "    }",
  "  }",
  "  return target;",
  "}"
];

export function testPrototypePollutionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([added("src/utils/merge.js", [...unguardedMerge, "settings[req.body.section][req.body.key] = req.body.value;"])]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Possible prototype pollution");
  assert.deepEqual(finding?.lines, [1, 11]);
  assert.equal(
    finding?.message,
    'Lines 1, 11 copy keys recursively without skipping `__proto__`, `constructor`, and `prototype`, and assign through two keys where one comes from the request, so input such as `{"__proto__": {"isAdmin": true}}` can add properties to every object in the process.'
  );
}

export function testPrototypePollutionReadsEachForm(): void {
  const cases: Array<[string, string[]]> = [
    [
      "src/utils/merge.ts",
      ["export const deepMerge = (a, b) => {", "  Object.keys(b).forEach((k) => {", "    a[k] = isObject(b[k]) ? deepMerge(a[k] ?? {}, b[k]) : b[k];", "  });", "  return a;", "};"]
    ],
    // jQuery-style: the target comes from `arguments`, and the call's result is stored in it.
    [
      "src/utils/extend.js",
      [
        "module.exports = function extend() {",
        "  var target = arguments[0];",
        "  for (var i = 1; i < arguments.length; i++) {",
        "    for (var name in arguments[i]) {",
        "      target[name] = extend(target[name] || {}, arguments[i][name]);",
        "    }",
        "  }",
        "  return target;",
        "};"
      ]
    ],
    // Only `__proto__` is skipped, so `constructor.prototype` still gets through.
    [
      "src/utils/assign.js",
      [
        "function assignDeep(target, source) {",
        "  for (const key in source) {",
        "    if (key === '__proto__') continue;",
        "    target[key] = assignDeep(target[key] || {}, source[key]);",
        "  }",
        "  return target;",
        "}"
      ]
    ],
    ["src/routes/settings.js", ["const { section, key, value } = req.body;", "config[section][key] = value;"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines[0]}`);
  }
}

export function testPrototypePollutionSkipsGuardedAndShallowCopies(): void {
  const cases: Array<[string, string[]]> = [
    [
      "src/utils/merge.js",
      [
        "function merge(target, source) {",
        "  for (const key in source) {",
        "    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;",
        "    target[key] = merge(target[key] || {}, source[key]);",
        "  }",
        "  return target;",
        "}"
      ]
    ],
    ["src/utils/merge.js", ["function merge(target, source) {", "  for (const key in source) {", "    if (!isSafeKey(key)) continue;", "    target[key] = merge(target[key], source[key]);", "  }", "}"]],
    // Shallow copies, and merges that write into a new object.
    ["src/utils/assign.js", ["function assign(target, source) {", "  for (const key in source) {", "    target[key] = source[key];", "  }", "  return target;", "}"]],
    [
      "src/utils/merge.js",
      ["function merge(a, b) {", "  const out = {};", "  for (const key of Object.keys(b)) {", "    out[key] = merge(a[key], b[key]);", "  }", "  return out;", "}"]
    ],
    [
      "src/utils/clone.js",
      ["function clone(value) {", "  value = { ...value };", "  for (const key of Object.keys(value)) {", "    value[key] = clone(value[key]);", "  }", "  return value;", "}"]
    ],
    // Keys that do not come from the request, or that are checked first.
    ["src/routes/settings.js", ["settings[section][key] = value;"]],
    ["src/routes/settings.js", ["const key = req.body.key;", "obj[key] = req.body.value;"]],
    ["src/routes/settings.js", ["const { section, key } = req.body;", "if (section === '__proto__') return;", "config[section][key] = 1;"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPrototypePollutionSkipsTestsAndOtherFiles(): void {
  assert.deepEqual(
    findings([added("src/utils/merge.test.js", unguardedMerge), added("fixtures/merge.js", unguardedMerge), added("src/merge.py", unguardedMerge)]),
    []
  );
}

export function testPrototypePollutionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { prototypePollution: { enabled: false } } });

  assert.deepEqual(findings([added("src/utils/merge.js", unguardedMerge)], config), []);
}
