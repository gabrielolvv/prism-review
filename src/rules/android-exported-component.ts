import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Component = { line: number; kind: "service" | "receiver" | "provider"; name: string };

const manifestFile = /(?:^|\/)AndroidManifest\.xml$/;
// Debug, QA, and instrumentation-test manifests, which only internal builds and tests merge in.
const debugManifest = /(?:^|\/)src\/(?:debug|qa|androidTest|test|testDebug|benchmark)\//i;

const componentStart = /<(service|receiver|provider)\b/;
const exported = /\bandroid:exported\s*=\s*"true"/;
const permission = /\bandroid:(?:permission|readPermission|writePermission)\s*=\s*"[^"]+"|<path-permission\b/;
const removed = /\btools:node\s*=\s*"(?:remove|removeAll)"/;
const nameAttribute = /\bandroid:name\s*=\s*"([^"]+)"/;
const action = /<action\b[^>]*\bandroid:name\s*=\s*"([^"]+)"/g;
// Broadcasts and service interfaces that Android, Google Play services, and phone makers define, such
// as `android.intent.action.BOOT_COMPLETED`, HTC's `QUICKBOOT_POWERON`, Wear OS's `MESSAGE_RECEIVED`,
// or `android.media.browse.MediaBrowserService`. Only the system or Play services send most of these,
// and these services check their callers themselves, as media sessions and Android Auto apps do.
const systemAction = /^(?:android\.|com\.android\.|com\.google\.android\.|com\.htc\.intent\.action\.|androidx\.media|androidx\.car\.app\.)/;
const maxComponentLines = 80;

// The start tag and, unless it closes itself, the body of the component that starts at `index`.
function componentLines(lines: PatchLine[], index: number, kind: string): { tag: PatchLine[]; body: PatchLine[] } {
  const tag: PatchLine[] = [];
  let position = index;
  for (; position < lines.length && position < index + maxComponentLines; position += 1) {
    const line = lines[position];
    if (line === undefined || (position > index && line.startsHunk)) {
      break;
    }
    tag.push(line);
    if (/>/.test(line.content.slice(position === index ? line.content.indexOf("<") : 0))) {
      break;
    }
  }
  const closes = /\/>\s*$/.test(tag.at(-1)?.content ?? "");
  const body: PatchLine[] = [];
  if (!closes) {
    const end = new RegExp(`</${kind}\\s*>`);
    for (position += 1; position < lines.length && position < index + maxComponentLines; position += 1) {
      const line = lines[position];
      if (line === undefined || line.startsHunk) {
        break;
      }
      body.push(line);
      if (end.test(line.content)) {
        break;
      }
    }
  }
  return { tag, body };
}

function exportedComponents(lines: PatchLine[]): Component[] {
  const found: Component[] = [];
  lines.forEach(({ content }, index) => {
    const start = componentStart.exec(content);
    if (start === null || /^\s*<!--/.test(content)) {
      return;
    }
    const kind = start[1] as Component["kind"];
    const { tag, body } = componentLines(lines, index, kind);
    const tagText = tag.map(({ content: text }) => text).join(" ");
    const exportLine = tag.find(({ content: text }) => exported.test(text));
    if (exportLine === undefined || !tag.some(({ added }) => added) || permission.test(tagText) || removed.test(tagText)) {
      return;
    }
    const bodyText = body.map(({ content: text }) => text).join(" ");
    if (permission.test(bodyText)) {
      return;
    }
    // Receivers and services that only answer Android's own broadcasts and interfaces.
    const actions = [...bodyText.matchAll(action)].map((match) => match[1] ?? "");
    if (kind !== "provider" && actions.length > 0 && actions.every((name) => systemAction.test(name))) {
      return;
    }
    found.push({ line: exportLine.line, kind, name: nameAttribute.exec(tagText)?.[1] ?? kind });
  });
  return found;
}

const kindNames: Record<Component["kind"], string> = { service: "service", receiver: "broadcast receiver", provider: "content provider" };

export const androidExportedComponentRule: Rule = {
  id: "android-exported-component",
  description: "Flags Android services, broadcast receivers, and content providers exported to every app with no permission.",
  run({ files, config }) {
    if (!config.rules.androidExportedComponent.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !manifestFile.test(file.path) ||
        file.patch === undefined ||
        debugManifest.test(file.path) ||
        // Sample, demo, and test apps.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = exportedComponents(patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const named = found.slice(0, 5).map(({ kind, name }) => `the ${kindNames[kind]} \`${name}\``);
      const them = found.length > 1 ? "them" : "it";
      const abilities = [
        `call ${them}`,
        ...(found.some(({ kind }) => kind === "provider") ? ["read and change the provider's data"] : []),
        `use this app's data and permissions through ${them}`
      ];
      return [
        {
          ruleId: "android-exported-component",
          title: "Android component open to every app",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "export" : "exports"} ${listOf(found.length > 5 ? [...named, `${found.length - 5} more`] : named)} with no permission, so any app installed on the device can ${listOf(abilities)}.`,
          recommendation:
            "Set `android:exported=\"false\"` on components that only this app uses. Protect the others with `android:permission`, using a permission with `android:protectionLevel=\"signature\"` when only your own apps should call them, or check the caller in code, and give content providers `android:readPermission` and `android:writePermission`."
        }
      ];
    });
  }
};
