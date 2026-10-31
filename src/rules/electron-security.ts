import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Settings that give the page Node.js or turn off the same-origin policy, so a script injected
// through XSS or a loaded URL can run commands on the user's computer. The rest weaken isolation.
type Setting = { label: string; pattern: RegExp; critical: boolean };

// An option set to a value, as a property or a quoted key, but not as text that mentions it, such
// as a message that reads "nodeIntegration: true".
function option(names: string, value: string): RegExp {
  return new RegExp(`(?:(?<![\\w"'\`])(?:${names})|["'](?:${names})["'])\\s*:\\s*${value}\\b`);
}

const preferences: Setting[] = [
  { label: "nodeIntegration: true", pattern: option("nodeIntegration(?:InWorker|InSubFrames)?", "true"), critical: true },
  { label: "contextIsolation: false", pattern: option("contextIsolation", "false"), critical: true },
  { label: "webSecurity: false", pattern: option("webSecurity", "false"), critical: true },
  { label: "sandbox: false", pattern: option("sandbox", "false"), critical: false },
  { label: "allowRunningInsecureContent: true", pattern: option("allowRunningInsecureContent", "true"), critical: false },
  { label: "experimentalFeatures: true", pattern: option("experimentalFeatures", "true"), critical: false },
  { label: "enableRemoteModule: true", pattern: option("enableRemoteModule", "true"), critical: false }
];

const switches: Setting[] = [
  {
    label: "a command line switch that turns off certificate or same-origin checks",
    pattern: /\bappendSwitch\s*\(\s*["'](?:ignore-certificate-errors|disable-web-security)["']/,
    critical: true
  },
  {
    label: "a command line switch that turns off the sandbox or allows insecure content",
    pattern: /\bappendSwitch\s*\(\s*["'](?:no-sandbox|allow-running-insecure-content)["']/,
    critical: false
  },
  // A `<webview>` tag's attributes.
  { label: "<webview nodeintegration>", pattern: /<webview\b[^>]*\snodeintegration(?:insubframes)?\b/i, critical: true },
  { label: "<webview disablewebsecurity>", pattern: /<webview\b[^>]*\sdisablewebsecurity\b/i, critical: true }
];

// A `certificate-error` handler or certificate check that accepts every certificate.
const certificateHandler = /\.on\s*\(\s*["']certificate-error["']|\bsetCertificateVerifyProc\s*\(/;
const acceptsCertificate = /\b(?:callback|cb|done)\s*\(\s*(?:true|0)\s*\)/;
// How far, in lines, a handler's body is read.
const handlerReach = 8;

// webPreferences only mean Electron next to a window or an Electron import; Puppeteer and other
// tools have options with the same names.
const electronContext = /\b(?:BrowserWindow|BrowserView|WebContentsView|webPreferences|electron)\b|<webview\b/;

const sourceFile = /\.(?:[cm]?[jt]sx?|html?|vue|svelte|json)$/i;
const commentLine = /^\s*(?:\/\/|\/\*|\*|<!--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const maxLineLength = 1_000;

export const electronSecurityRule: Rule = {
  id: "electron-security",
  description: "Flags Electron windows that give web content Node.js, turn off context isolation or web security, or accept any certificate.",
  run({ files, config }) {
    if (!config.rules.electronSecurity.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sourceFile.test(file.path) ||
        file.patch === undefined ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      if (!lines.some(({ content }) => electronContext.test(content))) {
        return [];
      }

      const found: Array<{ line: number; setting: Setting }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const code = withoutText(content);
        for (const setting of [...preferences, ...switches]) {
          if (setting.pattern.test(code)) {
            found.push({ line, setting });
          }
        }
        if (acceptsCertificate.test(content) && acceptsEveryCertificate(lines, index)) {
          found.push({ line, setting: { label: "a certificate check that accepts every certificate", pattern: acceptsCertificate, critical: true } });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const numbers = [...new Set(found.map((match) => match.line))];
      const labels = [...new Set(found.map((match) => match.setting.label))];
      const critical = found.some((match) => match.setting.critical);
      const { text, plural } = describeLines(numbers);
      return [
        {
          ruleId: "electron-security",
          title: "Electron security setting weakened",
          severity: critical ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: numbers[0],
          lines: numbers,
          message: `${text} ${plural ? "weaken" : "weakens"} Electron's isolation between web content and the computer (${labels.join(", ")}). ${
            critical
              ? "A script injected into the page, through XSS or a URL it loads, can then use Node.js or other sites' data and run commands on the user's computer."
              : "A compromised page then has more of the system within its reach."
          }`,
          recommendation:
            "Keep Electron's defaults: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`, and expose only the functions the page needs through a preload script with `contextBridge.exposeInMainWorld`. Trust a private certificate authority by adding its certificate instead of accepting every certificate."
        }
      ];
    });
  }
};

// Blanks out quoted text with spaces in it, such as a message that mentions a setting, and keeps
// quoted keys and values such as "nodeIntegration" or 'ignore-certificate-errors'.
function withoutText(content: string): string {
  return content.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, (quoted) => (/\s/.test(quoted) ? " ".repeat(quoted.length) : quoted));
}

// The line accepts a certificate inside a `certificate-error` handler or a certificate check that
// starts a few lines above, in the same hunk.
function acceptsEveryCertificate(lines: Array<{ content: string; startsHunk: boolean }>, index: number): boolean {
  for (let other = index; other >= Math.max(0, index - handlerReach); other -= 1) {
    const content = lines[other]?.content ?? "";
    if (certificateHandler.test(content)) {
      return true;
    }
    if (lines[other]?.startsHunk) {
      break;
    }
  }
  return false;
}
