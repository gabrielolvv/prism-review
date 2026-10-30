import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Paths for administration and internal tools.
const adminPath = /^\/?(?:api\/)?(?:v\d+\/)?(?:admin|administrator|superadmin|superuser|backoffice|back-office|staff|internal|manage|management|sudo)(?:\/|$|:|\?)/i;
// Names of middleware, decorators, and wrappers that check who is calling.
const guardName =
  /auth|login|logged|session|jwt|token|passport|guard|protect|permission|perm\b|perms|role|acl|policy|restrict|secure|(?:^|[._])(?:is|require|ensure|verify|check|has|must|only)[A-Z_]|_required\b|Required\b|requires_|can\(|admin_?only|adminOnly|staff_member_required|user_passes_test|superuser/i;
// A check inside the handler: the user's role, a 401 or 403, or an authentication call.
const inlineCheck =
  /\breq\.(?:user|session|auth)\b|\bisAuthenticated\b|\bhasRole\b|\bisAdmin\b|\bis_admin\b|\bis_staff\b|\bis_superuser\b|\bcurrent_user\b|\bg\.user\b|\babort\s*\(\s*40[13]\b|\bstatus\s*\(\s*40[13]\b|\bStatus(?:Unauthorized|Forbidden)\b|\b40[13]\b|Forbidden|Unauthorized|\bauth\(\)|->can\(|Gate::/;
// Protection for the whole file: middleware applied to a router, app, or group, or a hook that runs
// before every request.
const fileGuard =
  /\.use\s*\([^)]*(?:auth|login|session|jwt|passport|guard|protect|permission|role|acl|require|ensure|verify|isAdmin|admin)/i;
const fileHooks = /\.Group\s*\(\s*"[^"]*"\s*,[^)]*(?:auth|login|session|jwt|token|guard|protect|permission|role|acl|require|ensure|verify|admin)|\bbefore_request\b|\bbefore_action\b|\bbeforeEach\b|\.addHook\s*\(\s*["'](?:onRequest|preHandler)["']|\bmiddleware\s*\(\s*\[?[^)]*(?:auth|admin|role|can:|permission|verified)/i;

type Route = { line: number; index: number; path: string; guarded: boolean };

type Language = {
  files: RegExp;
  // A route registration: group 1 is the path, and the text after the match holds the handlers.
  route: RegExp;
  guarded(lines: PatchLine[], index: number, rest: string): boolean;
};

const javascript: Language = {
  // Express, Koa Router, Fastify, Hono.
  files: /\.(?:[cm]?[jt]sx?)$/i,
  route: /\b(?:app|router|server|fastify|api|admin\w*|routes?|r)\.(?:get|post|put|patch|delete|del|all|use|route)\s*\(\s*["'`]([^"'`]+)["'`]\s*,?/,
  guarded(lines, index, rest) {
    const args = rest.split(",").map((part) => part.trim());
    const middleware = args.slice(0, -1).join(",");
    return guardName.test(middleware) || bodyChecks(lines, index);
  }
};

const python: Language = {
  // Flask and Quart routes, with the decorators above or below the route.
  files: /\.py$/i,
  route: /^\s*@\w+\.(?:route|get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/,
  guarded(lines, index) {
    const decorators: string[] = [];
    for (let at = index - 1; at >= 0 && /^\s*@/.test(lines[at]?.content ?? ""); at -= 1) {
      decorators.push(lines[at]?.content ?? "");
    }
    for (let at = index + 1; at < lines.length && /^\s*@/.test(lines[at]?.content ?? ""); at += 1) {
      decorators.push(lines[at]?.content ?? "");
    }
    return decorators.some((decorator) => guardName.test(decorator)) || bodyChecks(lines, index);
  }
};

const go: Language = {
  // net/http, gin, echo, chi, and fiber.
  files: /\.go$/i,
  route: /\b(?:http\.Handle(?:Func)?|\w+\.(?:GET|POST|PUT|PATCH|DELETE|Any|Handle|HandleFunc|Get|Post|Put|Patch|Delete|Group|Route|Mount))\s*\(\s*"([^"]+)"\s*,?/,
  guarded(lines, index, rest) {
    const args = rest.split(",").map((part) => part.trim());
    return guardName.test(args.slice(0, -1).join(",")) || guardName.test(args.at(-1) ?? "") || bodyChecks(lines, index);
  }
};

const php: Language = {
  // Laravel routes, alone or inside a group that applies middleware.
  files: /\.php$/i,
  route: /\bRoute::(?:get|post|put|patch|delete|any|match|resource|prefix|group)\s*\(\s*["']([^"']+)["']/,
  guarded(lines, index, rest) {
    if (/->middleware\s*\(/.test(rest) && guardName.test(rest)) {
      return true;
    }
    // An enclosing `Route::middleware([...])->group(function () {` within the lines above.
    return lines
      .slice(Math.max(0, index - 30), index)
      .some(({ content }) => /middleware\s*\(/.test(content) && /->group\s*\(/.test(content) && guardName.test(content));
  }
};

const languages = [javascript, python, go, php];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const bodyReach = 12;

export const adminRouteAuthRule: Rule = {
  id: "admin-route-auth",
  description: "Flags admin and internal routes registered without an authentication or role check.",
  run({ files, config }) {
    if (!config.rules.adminRouteAuth.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const language = languages.find((candidate) => candidate.files.test(file.path));
      if (
        language === undefined ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const routes = findRoutes(lines, language);
      const adminRoutes = routes.filter((route) => adminPath.test(route.path));
      const unguarded = adminRoutes.filter((route) => !route.guarded && lines[route.index]?.added);
      if (unguarded.length === 0) {
        return [];
      }
      // A new file shows everything that could protect its routes. In a changed file, protection may
      // sit outside the patch, so a route only counts when another route the patch shows is guarded.
      const visible = lines.map(({ content }) => content).join("\n");
      if (fileGuard.test(visible) || fileHooks.test(visible)) {
        return [];
      }
      if (file.status !== "added" && !routes.some((route) => route.guarded)) {
        return [];
      }

      const lineNumbers = unguarded.map((route) => route.line);
      const { text, plural } = describeLines(lineNumbers);
      return [
        {
          ruleId: "admin-route-auth",
          title: "Admin route without an access check",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "register admin or internal routes" : "registers an admin or internal route"} with no authentication or role check in sight, so anyone who finds the URL can use ${plural ? "them" : "it"}.`,
          recommendation:
            "Put an authentication and role check in front of the route, such as Express middleware like `requireAdmin`, Flask's `@login_required` with a role check, a gin group with an auth middleware, or Laravel's `->middleware(['auth', 'can:admin'])`. If a router or gateway already protects it elsewhere, say so in the review."
        }
      ];
    });
  }
};

function findRoutes(lines: PatchLine[], language: Language): Route[] {
  return lines.flatMap(({ line, content }, index) => {
    if (commentLine.test(content)) {
      return [];
    }
    const match = language.route.exec(content);
    if (match === null) {
      return [];
    }
    const rest = content.slice(match.index + match[0].length);
    return [{ line, index, path: match[1] ?? "", guarded: language.guarded(lines, index, rest) }];
  });
}

// The first lines of the handler check the user, as in `if (!req.user?.isAdmin) return res.status(403)`.
function bodyChecks(lines: PatchLine[], index: number): boolean {
  const start = lines[index];
  if (start === undefined) {
    return false;
  }
  return lines.slice(index, index + bodyReach).some(({ line, content }) => line - start.line < bodyReach && inlineCheck.test(content));
}
