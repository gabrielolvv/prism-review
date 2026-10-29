import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "world-writable" | "setuid" | "open-umask";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  "world-writable": "makes files writable by every user",
  setuid: "sets the setuid bit, so a program runs with its owner's rights",
  "open-umask": "sets a umask that leaves new files writable by every user"
};

// A shell `chmod`, after its flags; Docker's `COPY --chmod=` and `ADD --chmod=`; and chmod calls in
// Python, Node.js, Go, and Ruby, whose mode the umask does not limit.
const shellChmod = /\bchmod\s+(?:(?:-[A-Za-z]{1,10}|--[\w-]{1,30}(?:=\S{1,200})?)\s+){0,5}([0-7]{1,4}|[ugoa+=,\-rwxXst]{1,50})(?=\s|$|[;&|)'"])/g;
const dockerChmod = /--chmod=([0-7]{1,4}|[ugoa+=,\-rwxXst]{1,50})(?=\s|$)/g;
const chmodCall = /\b(?:chmod|Chmod|chmodSync|lchmod|fchmod)\s*\(\s*[^,()]{1,300},\s*(0o?[0-7]{3,4})\b/g;
const shellUmask = /(?:^|[\s;&|(])umask\s+(0{0,4}[0-7]{1,4})(?=\s|$|[;&|)])/g;
const umaskCall = /\b(?:umask|Umask)\s*\(\s*(0o?[0-7]{0,4}|0)\s*\)/g;

const commentLine = /^\s*(?:#|\/\/|\*|REM\b|::)/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const filePermissionsRule: Rule = {
  id: "file-permissions",
  description: "Flags commands and code that make files writable by every user, set the setuid bit, or open the umask.",
  run({ files, config }) {
    if (!config.rules.filePermissions.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = patchLines(file.patch).flatMap(({ line, content, added }) =>
        added && !commentLine.test(content) ? kindsIn(content).map((kind) => ({ line, kind })) : []
      );
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const lines = [...new Set(found.map((match) => match.line))];
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "file-permissions",
          title: "Unsafe file permissions",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...lines),
          lines,
          message: `${text} ${plural ? "change" : "changes"} file permissions in a way that ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "Grant the owner and group what they need, such as 755 for programs and 644 or 640 for data, keep the setuid bit off, and keep a umask of 022 or stricter. Shared temporary directories can use 1777, whose sticky bit stops users from deleting each other's files."
        }
      ];
    });
  }
};

function kindsIn(content: string): Kind[] {
  const kinds = new Set<Kind>();
  for (const pattern of [shellChmod, dockerChmod, chmodCall]) {
    for (const match of content.matchAll(pattern)) {
      for (const kind of modeKinds(match[1] ?? "")) {
        kinds.add(kind);
      }
    }
  }
  for (const pattern of [shellUmask, umaskCall]) {
    for (const match of content.matchAll(pattern)) {
      // `old = os.umask(0)` reads the current umask, to restore it right after.
      if (pattern === umaskCall && /(?:=|return)\s*$/.test(content.slice(0, match.index).replace(/[\w.]+$/, ""))) {
        continue;
      }
      const digits = (match[1] ?? "").replace(/^0o/, "");
      // The last digit is what others may not do; without its write bit, they can write.
      const others = Number(digits.at(-1) ?? "0");
      if ((others & 2) === 0) {
        kinds.add("open-umask");
      }
    }
  }
  return [...kinds];
}

function modeKinds(mode: string): Kind[] {
  const octal = /^(?:0o)?([0-7]{1,4})$/.exec(mode)?.[1];
  if (octal !== undefined) {
    const digits = octal.padStart(3, "0");
    const special = digits.length === 4 ? Number(digits[0]) : 0;
    const others = Number(digits.at(-1));
    return [
      // The sticky bit, as in 1777 for /tmp, keeps a shared directory safe to write to.
      ...((others & 2) !== 0 && (special & 1) === 0 ? ["world-writable" as const] : []),
      ...((special & 4) !== 0 ? ["setuid" as const] : [])
    ];
  }

  const kinds: Kind[] = [];
  for (const clause of mode.split(",")) {
    const parts = /^([ugoa]*)([+=])([rwxXst]*)$/.exec(clause);
    if (parts === null) {
      continue;
    }
    const [, who = "", , permissions = ""] = parts;
    // Without a who, chmod applies the umask, which normally keeps others from writing.
    if (/[oa]/.test(who) && permissions.includes("w")) {
      kinds.push("world-writable");
    }
    if ((who === "" || /[ua]/.test(who)) && permissions.includes("s")) {
      kinds.push("setuid");
    }
  }
  return kinds;
}

function joinLabels(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
}
