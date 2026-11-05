import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// The project's own folder: the current directory, the parent, the file's own folder, or the working
// directory, with nothing joined after it.
const here = String.raw`(?:["'\`]\.\.?\/?["'\`]|__dirname|process\.cwd\(\s*\)|path\.(?:join|resolve)\(\s*(?:__dirname|process\.cwd\(\s*\))\s*(?:,\s*["'\`]\.\.?\/?["'\`]\s*)?\))`;
const pythonHere = String.raw`(?:["']\.?\/?["']|os\.getcwd\(\s*\)|os\.path\.dirname\(\s*(?:os\.path\.abspath\(\s*)?__file__\s*\)?\s*\)|(?:settings\.)?BASE_DIR|Path\(\s*__file__\s*\)\.(?:resolve\(\s*\)\.)?parent)`;

const settings: Array<{ files: RegExp; pattern: RegExp; context?: RegExp }> = [
  // Express, Connect's serve-static, koa-static, and sirv.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: new RegExp(String.raw`\b(?:express\.static|serveStatic|koaStatic|staticServe|sirv)\s*\(\s*${here}\s*[,)]`) },
  // @fastify/static's and koa-static's root option.
  { files: /\.(?:[cm]?[jt]sx?)$/i, pattern: new RegExp(String.raw`\broot\s*:\s*${here}\s*[,}\n]|\broot\s*:\s*${here}\s*$`), context: /["'](?:@fastify\/static|fastify-static|koa-static|@nestjs\/serve-static)["']/ },
  // Flask's static folder, Starlette's and FastAPI's StaticFiles, Django's static view, and aiohttp.
  { files: /\.py$/i, pattern: new RegExp(String.raw`\bstatic_folder\s*=\s*${pythonHere}\s*[,)]`) },
  { files: /\.py$/i, pattern: new RegExp(String.raw`\bStaticFiles\s*\(\s*directory\s*=\s*${pythonHere}\s*[,)]`) },
  { files: /\.py$/i, pattern: new RegExp(String.raw`["']document_root["']\s*:\s*${pythonHere}\s*[,}]`) },
  { files: /\.py$/i, pattern: new RegExp(String.raw`\.add_static\s*\(\s*["'][^"']*["']\s*,\s*${pythonHere}\s*[,)]`) },
  // Go's net/http and the Gin, Echo, and Fiber static handlers.
  { files: /\.go$/i, pattern: /\bhttp\.FileServer\s*\(\s*http\.Dir\s*\(\s*"\.{1,2}\/?"\s*\)\s*\)/ },
  { files: /\.go$/i, pattern: /\.Static(?:FS)?\s*\(\s*"[^"]*"\s*,\s*(?:"\.{1,2}\/?"|http\.Dir\s*\(\s*"\.{1,2}\/?"\s*\))\s*\)/ },
  // Sinatra's public folder set to the app's own folder.
  { files: /\.rb$/i, pattern: /\bset\s+:public_folder\s*,\s*(?:__dir__|File\.dirname\(\s*__FILE__\s*\)|["']\.\/?["'])\s*$/ },
  // Spring Boot's static locations at the classpath root, which holds application.properties, or
  // the working directory.
  {
    files: /(?:^|\/)(?:application|bootstrap)[^/]*\.(?:properties|ya?ml)$/i,
    pattern: /\bstatic-locations\s*[=:]\s*(?:.*,\s*)?["']?(?:classpath:\/|file:\.\/?|file:)["']?\s*(?:,|$)/
  }
];

// Code that serves the folder only in development, behind an environment check.
const condition = /\bif\b|\belif\b|\bunless\b|\?|&&/;
const environment = /NODE_ENV|\bENV\b|isDev|IsDevelopment|__DEV__|debug|development|\bdev\b|isProd|production|\bprod\b|settings\.DEBUG/i;
const guardWindow = 2;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const staticRootExposureRule: Rule = {
  id: "static-root-exposure",
  description: "Flags static file handlers that serve the project's own folder, which holds the source code, .env files, and the .git folder.",
  run({ files, config }) {
    if (!config.rules.staticRootExposure.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development servers, examples, and tests serve the folder they run in on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const found: number[] = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content) || !active.some(({ pattern }) => pattern.test(content))) {
          return;
        }
        const nearby = lines.slice(Math.max(0, index - guardWindow), index + 1);
        if (nearby.some(({ content: other }) => condition.test(other) && environment.test(other))) {
          return;
        }
        found.push(line);
      });
      if (found.length === 0) {
        return [];
      }

      const { text: where, plural } = describeLines(found);
      return [
        {
          ruleId: "static-root-exposure",
          title: "Project folder served as static files",
          severity: "warning" as const,
          file: file.path,
          line: found[0],
          lines: found,
          message: `${where} ${plural ? "serve" : "serves"} the project's own folder as static files, so anyone can download the source code, \`.env\` files and other settings with their secrets, and the \`.git\` folder with the whole history.`,
          recommendation:
            "Serve a folder that holds only public files, such as `public/` or `dist/`, by its full path, such as `express.static(path.join(__dirname, 'public'))`, `http.Dir(\"./public\")`, or `classpath:/static/`, and keep secrets and source outside it."
        }
      ];
    });
  }
};
