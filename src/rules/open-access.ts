import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Kind = "app" | "database";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  app: ["turns authentication off for every route", "turn authentication off for every route"],
  database: ["lets anyone read or write the database", "let anyone read or write the database"]
};

const settings: Array<{ kind: Kind; files: RegExp; pattern: RegExp }> = [
  // Spring Security permitting every request, or every path.
  {
    kind: "app",
    files: /\.(?:java|kt)$/i,
    pattern: /\banyRequest\s*\(\s*\)\s*\.permitAll\s*\(\s*\)|\b(?:requestMatchers|antMatchers|mvcMatchers)\s*\(\s*"\/\*\*"\s*\)\s*\.permitAll\s*\(\s*\)|\bweb\s*\.\s*ignoring\s*\(\s*\)\s*\.\s*(?:anyRequest\s*\(\s*\)|(?:requestMatchers|antMatchers)\s*\(\s*"\/\*\*"\s*\))/
  },
  // Flask-Login's switch that makes login_required do nothing.
  { kind: "app", files: /\.py$/i, pattern: /\bLOGIN_DISABLED["']?\s*\]?\s*[:=]\s*True\b/ },
  // Devise's or a custom authentication filter skipped in ApplicationController, for every controller.
  {
    kind: "app",
    files: /(?:^|\/)application_controller\.rb$/i,
    pattern: /^\s*skip_before_action\s+:(?:authenticate_\w+!?|require_login|require_user|authorize\w*)\b(?![^\n]*\b(?:only|if|unless):)/
  },
  // ASP.NET Core: every controller endpoint opened.
  { kind: "app", files: /\.cs$/i, pattern: /\.Map(?:Controllers|ControllerRoute|DefaultControllerRoute|RazorPages)\s*\([^)]*\)\s*\.AllowAnonymous\s*\(\s*\)/ },
  // Laravel's auth middleware removed from a group.
  { kind: "app", files: /\.php$/i, pattern: /->\s*withoutMiddleware\s*\(\s*\[?\s*["'](?:auth|auth:\w+)["']|->\s*withoutMiddleware\s*\(\s*\[?\s*\\?(?:App\\Http\\Middleware\\)?Authenticate::class/ },
  // Firebase security rules: a match that allows reads or writes to everyone.
  { kind: "database", files: /\.rules$|(?:^|\/)(?:firestore|storage)\.rules$/i, pattern: /^\s*allow\s+[\w\s,]*\b(?:write|create|update|delete)\b[\w\s,]*(?::\s*if\s+true\s*)?;|^\s*allow\s+[\w\s,]*\bread\b[\w\s,]*:\s*if\s+true\s*;/ },
  // Realtime Database rules.
  { kind: "database", files: /(?:^|\/)database\.rules\.json$|(?:^|\/)database\.json$/i, pattern: /["']\.(?:read|write)["']\s*:\s*(?:true|["']true["'])/ },
  // Postgres row level security turned off, or a write policy that holds for every row, as Supabase
  // exposes tables to the public anon key.
  {
    kind: "database",
    files: /\.sql$/i,
    pattern: /\bdisable\s+row\s+level\s+security\b|\bcreate\s+policy\b[^;]*\bfor\s+(?:all|insert|update|delete)\b[^;]*\b(?:using|with\s+check)\s*\(\s*true\s*\)/i
  }
];

// Django REST Framework's default permission set to AllowAny, read across the settings block.
const drfDefault = /\bDEFAULT_PERMISSION_CLASSES\b/;
const allowAny = /\bAllowAny\b/;
const drfWindow = 4;

// ASP.NET Core: [AllowAnonymous] on a controller class opens every action in it.
const allowAnonymousAttribute = /^\s*\[\s*AllowAnonymous\s*\]\s*$/;
const controllerClass = /\bclass\s+\w+Controller\b/;
const attributeWindow = 3;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const openAccessRule: Rule = {
  id: "open-access",
  description: "Flags authentication turned off for a whole app, and database rules that let anyone read or write.",
  run({ files, config }) {
    if (!config.rules.openAccess.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const python = /\.py$/i.test(file.path);
      const csharp = /\.cs$/i.test(file.path);
      if (
        (fileSettings.length === 0 && !python && !csharp) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps open access on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found: Array<{ line: number; kind: Kind }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        const setting = fileSettings.find(({ pattern }) => pattern.test(content));
        if (setting !== undefined) {
          found.push({ line, kind: setting.kind });
          return;
        }
        if (
          python &&
          allowAny.test(content) &&
          lines.slice(Math.max(0, index - drfWindow), index + 1).some(({ content: before }) => drfDefault.test(before))
        ) {
          found.push({ line, kind: "app" });
          return;
        }
        if (
          csharp &&
          allowAnonymousAttribute.test(content) &&
          lines.slice(index + 1, index + 1 + attributeWindow).some(({ content: after }) => controllerClass.test(after))
        ) {
          found.push({ line, kind: "app" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = found.map((match) => match.line);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      return [
        {
          ruleId: "open-access",
          title: "Access control turned off",
          severity: "high" as const,
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, so anyone who can reach the service can use it without signing in.`,
          recommendation:
            "Require authentication by default and open only the routes that must be public, such as login and health checks, by name. In Firebase and Supabase, write rules and policies that check `request.auth` or `auth.uid()` against the data's owner."
        }
      ];
    });
  }
};
