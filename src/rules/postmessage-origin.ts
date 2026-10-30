import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "wildcard" | "listener";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  wildcard: "sends a message to any origin with `*`, so the data reaches whatever page is loaded in that window",
  listener: "listens for messages from other windows without checking `event.origin`, so any website that can open or frame this page can send it commands"
};

// `postMessage(data, "*")` and `postMessage(data, { targetOrigin: "*" })` to another window, such as
// `parent`, `opener`, or an iframe's `contentWindow`. A window posting to itself, as setImmediate
// polyfills do, keeps the data in the page, and a worker's `postMessage(data, [buffer])` passes
// transferable objects instead.
const wildcardTarget = /(?<!(?:^|[^\w$.])(?:window|self|globalThis|global|_global|this))\.postMessage\s*\((?:[^()]|\([^()]*\))*?,\s*(?:["'`]\*["'`]|\{[^}]*\btargetOrigin\s*:\s*["'`]\*["'`])/;
// Message listeners on the window. Workers, MessagePorts, BroadcastChannels, and WebSockets also get
// "message" events, but not from other websites, so only the window's own listeners count; in a
// worker file, even a bare `addEventListener` is the worker's.
const windowListener =
  /\b(?:window|globalThis|top|parent)\.addEventListener\s*\(\s*["'`]message["'`]\s*,\s*(.*)$|^\s*(?:export\s+)?(?:\w+\s*\(\s*)?addEventListener\s*\(\s*["'`]message["'`]\s*,\s*(.*)$|\b(?:window|globalThis)\.onmessage\s*=\s*(.*)$/;
// React's useEffect and similar wrappers are fine: the listener is found on its own line.
const handlerName = /^\s*([A-Za-z_$#][\w$.#]*)\s*[,)]/;
// What a handler checks to know who sent the message, itself or by passing the event to a helper,
// as in `if (!sanitize(e, childOrigin)) return`.
const checksSender =
  /\borigin\b|\.source\s*[!=]==?|[!=]==?\s*[\w$.]*\.source\b|isTrusted|allowedOrigins?|trustedOrigins?|\b(?:sanitize|validate|verify|check|isValid|isAllowed|isTrusted)\w*\s*\(\s*(?:e|ev|evt|event|msg|message)\b/i;
// How far, in lines, a handler's body is read for an origin check.
const bodyReach = 25;

const browserFile = /\.(?:[cm]?[jt]sx?|vue|svelte|html?)$/i;
const workerFile = /(?:^|[/._-])(?:worker|sw|service-worker|serviceworker)(?:[/._-]|$)/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const commentLine = /^\s*(?:\/\/|\/\*|\*)/;
const maxLineLength = 1_000;

export const postMessageOriginRule: Rule = {
  id: "postmessage-origin",
  description: "Flags postMessage calls to any origin and window message listeners that do not check the sender's origin.",
  run({ files, config }) {
    if (!config.rules.postMessageOrigin.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !browserFile.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findIssues(file.patch, workerFile.test(file.path));
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "postmessage-origin",
          title: "Cross-window message without an origin check",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${kinds.map((kind) => (plural ? labels[kind].replace(/^(\w+)s /, "$1 ") : labels[kind])).join(", and ")}.`,
          recommendation:
            "Send messages to the exact origin of the receiving page, such as `postMessage(data, \"https://app.example.com\")`, and start every message handler by comparing `event.origin` with the origins it trusts, ignoring anything else."
        }
      ];
    });
  }
};

function findIssues(patch: string, worker: boolean): Array<{ line: number; kind: Kind }> {
  const lines = patchLines(patch);
  return lines.flatMap((current, index) => {
    const { line, content, added } = current;
    if (!added || content.length > maxLineLength || commentLine.test(content)) {
      return [];
    }
    const issues: Array<{ line: number; kind: Kind }> = [];
    if (wildcardTarget.test(content)) {
      issues.push({ line, kind: "wildcard" });
    }
    const listener = windowListener.exec(content);
    if (listener !== null) {
      const bare = listener[2] !== undefined;
      const handler = listener[1] ?? listener[2] ?? listener[3] ?? "";
      if (!(bare && worker) && !handlerChecksSender(handler, lines, index)) {
        issues.push({ line, kind: "listener" });
      }
    }
    return issues;
  });
}

// True when the handler checks the sender, or when it cannot be read: a named handler defined
// outside the patch is given the benefit of the doubt.
function handlerChecksSender(handler: string, lines: PatchLine[], index: number): boolean {
  const named = handlerName.exec(handler)?.[1];
  if (named !== undefined && !/^(?:function|async)$/.test(named)) {
    const name = named.slice(named.lastIndexOf(".") + 1).replace(/[$]/g, "\\$&");
    const definition = new RegExp(
      `(?:function\\s*\\*?\\s*${name}\\s*\\(|(?<![\\w$#])${name}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\(?[\\w$,\\s{}]*\\)?\\s*=>)|^\\s*(?:(?:private|public|protected|static|async)\\s+)*${name}\\s*\\([^)]*\\)\\s*(?::[^{]*)?\\{)`
    );
    // The definition closest before the listener, as a file may define the same name in several
    // functions, or else the first one after it.
    const matches = lines.flatMap(({ content }, at) => (definition.test(content) ? [at] : []));
    const start = matches.filter((at) => at < index).at(-1) ?? matches.find((at) => at > index) ?? -1;
    return start === -1 || readsSender(lines, start);
  }
  return readsSender(lines, index);
}

function readsSender(lines: PatchLine[], start: number): boolean {
  const first = lines[start];
  if (first === undefined) {
    return true;
  }
  return lines
    .slice(start, start + bodyReach)
    .some(({ line, content }) => line - first.line < bodyReach && checksSender.test(content));
}
