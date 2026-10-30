import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";
import { requestValue } from "./untrusted-input.js";

type Kind = "merge" | "nested-key";

// In the order the message lists them, for one line and for several.
const labels: Record<Kind, [string, string]> = {
  merge: [
    "copies keys recursively without skipping `__proto__`, `constructor`, and `prototype`",
    "copy keys recursively without skipping `__proto__`, `constructor`, and `prototype`"
  ],
  "nested-key": ["assigns through two keys where one comes from the request", "assign through two keys where one comes from the request"]
};

// The first parameter of a definition, which a merge writes into: `target` in `merge(target, source)`.
const firstParameter = /\(\s*(?:\{[^}]*\}|\[[^\]]*\]|([A-Za-z_$][\w$]*))/;
// jQuery-style merges take their objects from `arguments`: `var target = arguments[0]`.
const argumentsTarget = /(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*arguments\s*\[\s*0\s*\]/;
// Ways to make the target a copy before writing to it.
const copiedTarget = String.raw`=\s*(?:\{\s*\.\.\.|\[\s*\.\.\.|Object\.assign\s*\(\s*\{\s*\}|structuredClone\s*\(|JSON\.parse\s*\()`;
// Functions named for copying one object into another: merge, deepMerge, extend, assignDeep, clone,
// defaultsDeep, mixin, and the like.
const copyName = /merge|extend|assign|deep|clone|copy|defaults|mixin|combine|override/i;
const definitions = [
  /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:[\w$.]+\s*=\s*)*(?:async\s+)?(?:function\b[^(]*\(|\([^)]*\)\s*(?::[^=]*)?=>|[A-Za-z_$][\w$]*\s*=>)/,
  /^\s*(?:(?:public|private|protected|static|async|export|default)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::[^{]*)?\{\s*$/
];
// A loop over the keys of an object.
const keyLoop = /\bfor\s*\(\s*(?:const|let|var)?\s*[\w$[\]{},\s]+\s+(?:in|of)\s|\bObject\.(?:keys|entries|getOwnPropertyNames)\s*\(|\bReflect\.ownKeys\s*\(/;
// An assignment through a key held in a variable, such as `target[key] = ...`.
const computedAssignment = /[\w$\]]\s*\[\s*[A-Za-z_$][\w$]*\s*\]\s*=(?!=)/;
// What a merge checks so it never writes to a prototype: a helper or list of keys, or a check of
// `constructor` or `prototype`. Skipping only `__proto__` still lets `{"constructor": {"prototype": ...}}`
// through, as in assign-deep before 0.4.8.
const prototypeGuard =
  /["'`]constructor["'`]|["'`]prototype["'`]|[!=]==?\s*Object\.prototype\b|\bObject\.prototype\s*[!=]==?|is(?:Safe|Unsafe|Dangerous|Forbidden|Valid)(?:Key|Property|Prop)\b|isPrototypePolluted|Object\.create\(\s*null\s*\)|(?:unsafe|forbidden|blocked|dangerous|reserved|special)(?:Keys?|Props?|Properties)\b|(?:Keys|Props|Properties|Names)\.(?:has|includes)\s*\(|new\s+Map\b/i;
// How far, in lines, a function's body is read.
const bodyReach = 80;

// Writing through two keys reaches `Object.prototype` only through `__proto__`: `Object.prototype` itself
// cannot be replaced, so checking that one key is enough.
const nestedGuard = new RegExp(`__proto__|${prototypeGuard.source}`, "i");
// Two keys in a row, as in `obj[a][b] = value`.
const nestedAssignment = /\[\s*([^[\]]+?)\s*\]\s*\[\s*([^[\]]+?)\s*\]\s*=(?!=)/;
const assignment = /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]|]+\s*)?=(?!=)\s*(.*)$/;
const destructuring = /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(.*)$/;
const reach = 30;

const sourceFile = /\.(?:[cm]?[jt]sx?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const commentLine = /^\s*(?:\/\/|\/\*|\*)/;
const maxLineLength = 1_000;

export const prototypePollutionRule: Rule = {
  id: "prototype-pollution",
  description: "Flags recursive merges that do not skip prototype keys, and nested assignments through keys from the request.",
  run({ files, config }) {
    if (!config.rules.prototypePollution.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !sourceFile.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch).filter(({ content }) => content.length <= maxLineLength);
      const found = [...unguardedMerges(lines), ...nestedRequestKeys(lines)];
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map((match) => match.line))].sort((a, b) => a - b);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(lineNumbers);
      return [
        {
          ruleId: "prototype-pollution",
          title: "Possible prototype pollution",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, so input such as \`{"__proto__": {"isAdmin": true}}\` can add properties to every object in the process.`,
          recommendation:
            "Skip the keys `__proto__`, `constructor`, and `prototype` when copying or assigning by key, build lookups with `Object.create(null)` or a `Map`, or use a maintained merge such as lodash's `merge` or `structuredClone`. Validate request bodies against a schema before merging them."
        }
      ];
    });
  }
};

// Recursive copy functions added by the patch that loop over keys, assign by key into their target,
// go down into one of its keys, and never check for a prototype key. Going down means calling a copy
// function on `target[key]`, as in `merge(target[key], source[key])`, or storing a call to itself in
// it, as in `target[key] = extend(deep, clone, copy)`. A merge that writes into a new object cannot
// reach a prototype.
function unguardedMerges(lines: PatchLine[]): Array<{ line: number; kind: Kind }> {
  return lines.flatMap(({ line, content, added }, index) => {
    if (!added || commentLine.test(content)) {
      return [];
    }
    const name = definitions.map((pattern) => pattern.exec(content)?.[1]).find((candidate) => candidate !== undefined);
    if (name === undefined || !copyName.test(name) || /^(?:if|for|while|switch|catch|function|return)$/.test(name)) {
      return [];
    }
    const body = functionBody(lines, index);
    const target =
      firstParameter.exec(content.slice(content.indexOf(name) + name.length))?.[1] ??
      body.map(({ content: text }) => argumentsTarget.exec(text)?.[1]).find((candidate) => candidate !== undefined);
    if (target === undefined) {
      return [];
    }
    const escaped = (text: string) => text.replace(/\$/g, "\\$");
    const key = String.raw`\[\s*[A-Za-z_$][\w$]*\s*\]`;
    const descends = new RegExp(
      `(?<![\\w$])[\\w$]*(?:${copyName.source})[\\w$]*\\s*\\(\\s*${escaped(target)}\\s*\\[|(?<![\\w$.])${escaped(target)}\\s*${key}\\s*=\\s*(?:[\\w$.]+\\.)?${escaped(name)}\\s*\\(`,
      "i"
    );
    const writes = new RegExp(`(?<![\\w$.])${escaped(target)}\\s*${key}\\s*=(?!=)`);
    const copied = new RegExp(`(?<![\\w$.])${escaped(target)}\\s*${copiedTarget}`);
    return body.slice(1).some(({ content: text }) => descends.test(text)) &&
      !body.slice(1).some(({ content: text }) => copied.test(text)) &&
      body.some(({ content: text }) => keyLoop.test(text)) &&
      body.some(({ content: text }) => writes.test(text)) &&
      !body.some(({ content: text }) => prototypeGuard.test(text))
      ? [{ line, kind: "merge" as const }]
      : [];
  });
}

// The function's lines, from its definition to its closing brace, as far as the patch shows them.
function functionBody(lines: PatchLine[], start: number): PatchLine[] {
  const first = lines[start];
  if (first === undefined) {
    return [];
  }
  const body: PatchLine[] = [];
  let depth = 0;
  let opened = false;
  for (const current of lines.slice(start, start + bodyReach)) {
    if (current.line - first.line >= bodyReach || (current.startsHunk && body.length > 0)) {
      break;
    }
    body.push(current);
    for (const char of current.content) {
      if (char === "{") {
        depth += 1;
        opened = true;
      } else if (char === "}") {
        depth -= 1;
      }
    }
    if (opened && depth <= 0) {
      break;
    }
  }
  return body;
}

// `target[a][b] = value`, where `a` or `b` comes from the request, directly or through a name
// assigned from it.
function nestedRequestKeys(lines: PatchLine[]): Array<{ line: number; kind: Kind }> {
  const tainted = new Map<string, number>();
  const found: Array<{ line: number; kind: Kind }> = [];
  for (const { line, content, added } of lines) {
    if (commentLine.test(content)) {
      continue;
    }
    const isTainted = (text: string) =>
      requestValue.test(text) ||
      [...tainted].some(([name, at]) => line - at <= reach && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text));

    const nested = nestedAssignment.exec(content);
    if (added && nested !== null && !nestedGuard.test(content) && (isTainted(nested[1] ?? "") || isTainted(nested[2] ?? ""))) {
      found.push({ line, kind: "nested-key" });
    }

    const names = destructuring.exec(content);
    if (names !== null && requestValue.test(names[2] ?? "")) {
      for (const part of (names[1] ?? "").split(",")) {
        const name = /(?:^|:)\s*([A-Za-z_$][\w$]*)\s*(?:=.*)?$/.exec(part.trim())?.[1];
        if (name !== undefined) {
          tainted.set(name, line);
        }
      }
    }
    const single = assignment.exec(content);
    if (single?.[1] !== undefined) {
      if (isTainted(single[2] ?? "")) {
        tainted.set(single[1], line);
      } else {
        tainted.delete(single[1]);
      }
    }
    // A guard in the lines around clears what it checks, as in `if (key === "__proto__") return`.
    if (nestedGuard.test(content)) {
      tainted.clear();
    }
  }
  return found;
}
