import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

type Kind = "actuator" | "inspector" | "profiler" | "errorPage" | "graphql" | "phpinfo";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  actuator: "Spring Boot Actuator endpoints that show settings, memory, or let a caller shut the app down",
  inspector: "the Node.js inspector on every network interface",
  profiler: "Go's pprof handlers on the default server",
  errorPage: "a developer error page that shows stack traces outside development",
  graphql: "GraphQL introspection",
  phpinfo: "phpinfo(), which prints the server's settings and environment"
};

const high = new Set<Kind>(["actuator", "inspector"]);

// Actuator endpoints that show secrets or let a caller change the app: `*`, env and configprops
// (settings), heapdump and threaddump (memory, which holds secrets), logfile, sessions, jolokia
// (JMX), shutdown, and gateway (routes). health, info, metrics, and prometheus are not.
const sensitiveEndpoint = /(?:^|[\s,"'[])(?:\*|env|configprops|heapdump|threaddump|logfile|sessions|jolokia|shutdown|gateway|httptrace|httpexchanges)(?=$|[\s,"'\]])/;
const springFiles = /(?:^|\/)(?:application|bootstrap)[^/]*\.(?:properties|ya?ml)$/i;
const actuatorSettings = [
  // management.endpoints.web.exposure.include, on one line or under YAML's nested `exposure:`.
  /^\s*management\.endpoints\.web\.exposure\.include\s*[=:]\s*(.*)$/,
  // Boot 3 shows the values of settings only when asked to.
  /^\s*management\.endpoint\.(?:env|configprops)\.show-values\s*[=:]\s*["']?ALWAYS\b/i,
  /^\s*management\.endpoint\.shutdown\.(?:enabled|access)\s*[=:]\s*["']?(?:true|unrestricted)\b/i,
  // Boot 1 put the endpoints behind a login unless this turned it off.
  /^\s*(?:management\.security\.enabled|endpoints\.sensitive)\s*[=:]\s*["']?false\b/i
];
const yamlInclude = /^\s*include\s*:\s*(.*)$/;
const yamlExposure = /^\s*exposure\s*:\s*$/;
const yamlShowValues = /^\s*show-values\s*:\s*["']?ALWAYS\b/i;

// `node --inspect=0.0.0.0` in scripts, Dockerfiles, Compose files, and shell scripts.
const inspectorFiles = /(?:^|\/)(?:package\.json|Dockerfile[^/]*|[^/]*\.dockerfile|(?:docker-)?compose[^/]*\.ya?ml|Procfile)$|\.(?:sh|ya?ml|json|[cm]?js)$/i;
const inspector = /--inspect(?:-brk)?=(?:0\.0\.0\.0|\[?::\]?)(?::\d+)?\b/;

// Importing net/http/pprof for its side effect registers /debug/pprof on http.DefaultServeMux.
const pprofImport = /^\s*(?:import\s+)?_\s+"net\/http\/pprof"/;

// ASP.NET Core's developer exception page and the errorhandler package's middleware, unless an
// environment check comes just before. Apps name their own handlers errorHandler too, so the
// middleware counts only in files that import the package.
const developerExceptionPage = /\b(?:UseDeveloperExceptionPage|UseDatabaseErrorPage)\s*\(\s*\)/;
const errorhandlerMiddleware = /\.use\s*\(\s*(\w+)\s*\(\s*\)\s*\)/;
const errorhandlerImport = /(?:\bimport\s+(\w+)\s+from|\b(?:const|let|var)\s+(\w+)\s*=\s*require\s*\()\s*["']errorhandler["']/;
const environmentCheck = /\bIsDevelopment\s*\(|\bIsEnvironment\s*\(|NODE_ENV|\bget\s*\(\s*["']env["']\s*\)|\bdevelopment\b/i;
const environmentWindow = 4;

// Apollo Server, GraphQL Yoga, Mercurius, and NestJS turn introspection off in production unless
// told otherwise.
const introspection = /\bintrospection\s*:\s*true\b/;
// A plugin or validation rule next to the setting, such as Parse Server's IntrospectionControlPlugin
// or graphql-js' NoSchemaIntrospectionCustomRule, decides who may introspect instead.
const introspectionControl = /\b[A-Za-z]*Introspection[A-Za-z]*\s*[(,\]]/;
const introspectionWindow = 6;
const graphqlServer = /\b(?:ApolloServer|createYoga|mercurius|GraphQLModule|ApolloDriver|graphqlHTTP|createHandler)\b/;

// A call, but not a method, a string, or a function's definition.
const phpinfo = /(?<![\w$>:'"])(?<!function\s+)phpinfo\s*\(/;

// Benchmarks profile themselves on purpose.
const benchmarkPath = /(?:^|\/)bench(?:mark)?s?(?:\/|$)/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|<!--|;)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const debugEndpointRule: Rule = {
  id: "debug-endpoint",
  description: "Flags Spring Boot Actuator, the Node.js inspector, Go's pprof, developer error pages, GraphQL introspection, and phpinfo() exposed outside development.",
  run({ files, config }) {
    if (!config.rules.debugEndpoint.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test apps turn these on on purpose.
        developmentPath.test(file.path) ||
        benchmarkPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const spring = springFiles.test(file.path);
      const readsInspector = inspectorFiles.test(file.path);
      const go = /\.go$/i.test(file.path);
      const errorPages = /\.(?:cs|[cm]?[jt]sx?)$/i.test(file.path);
      const javascript = /\.(?:[cm]?[jt]sx?)$/i.test(file.path);
      const php = /\.php$/i.test(file.path);
      if (!spring && !readsInspector && !go && !errorPages && !php) {
        return [];
      }

      const lines = patchLines(file.patch);
      const graphql = javascript && lines.some(({ content }) => graphqlServer.test(content));
      const errorhandlerName = javascript ? lines.map(({ content }) => errorhandlerImport.exec(content)).find((match) => match !== null) : undefined;
      const errorhandler = errorhandlerName?.[1] ?? errorhandlerName?.[2];
      const found: Array<{ line: number; kind: Kind }> = [];
      // The YAML keys seen most recently at each indentation, for `include:` under `exposure:`.
      let underExposure = false;
      let exposureIndent = -1;
      let underManagementEndpoint = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          underExposure = false;
          underManagementEndpoint = false;
        }
        if (spring && /\.ya?ml$/i.test(file.path)) {
          const indent = content.search(/\S/);
          if (indent >= 0 && indent <= exposureIndent && !yamlExposure.test(content)) {
            underExposure = false;
          }
          if (yamlExposure.test(content)) {
            underExposure = true;
            exposureIndent = indent;
          }
          if (/^\s*(?:env|configprops)\s*:\s*$/.test(content)) {
            underManagementEndpoint = true;
          }
        }
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }

        if (spring && springSetting(content, underExposure, underManagementEndpoint)) {
          found.push({ line, kind: "actuator" });
        }
        if (readsInspector && inspector.test(content)) {
          found.push({ line, kind: "inspector" });
        }
        if (go && pprofImport.test(content)) {
          found.push({ line, kind: "profiler" });
        }
        if (errorPages && isErrorPage(content, errorhandler) && !lines.slice(Math.max(0, index - environmentWindow), index + 1).some(({ content: before }) => environmentCheck.test(before))) {
          found.push({ line, kind: "errorPage" });
        }
        if (
          graphql &&
          introspection.test(content) &&
          !lines.slice(Math.max(0, index - introspectionWindow), index + introspectionWindow + 1).some(({ content: near }) => introspectionControl.test(near))
        ) {
          found.push({ line, kind: "graphql" });
        }
        if (php && phpinfo.test(content)) {
          found.push({ line, kind: "phpinfo" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = [...new Set(found.map((match) => match.line))];
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      return [
        {
          ruleId: "debug-endpoint",
          title: "Debug endpoint exposed",
          severity: kinds.some((kind) => high.has(kind)) ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${plural ? "expose" : "exposes"} ${kinds.map((kind) => labels[kind]).join(", and ")}, which can give whoever reaches them secrets from settings or memory, the app's internals, or a way to run code.`,
          recommendation:
            "Turn these on only in development settings, or serve them on a port or path that only operators can reach and that requires a login. For Actuator, expose `health` and `info` and add others by name; for the Node.js inspector, bind to `127.0.0.1`; for pprof, register its handlers on a separate internal server instead of importing it for its side effect."
        }
      ];
    });
  }
};

function springSetting(content: string, underExposure: boolean, underManagementEndpoint: boolean): boolean {
  const [include, ...others] = actuatorSettings;
  const exposed = include?.exec(content)?.[1] ?? (underExposure ? yamlInclude.exec(content)?.[1] : undefined);
  if (exposed !== undefined && sensitiveEndpoint.test(` ${exposed}`)) {
    return true;
  }
  return others.some((pattern) => pattern.test(content)) || (underManagementEndpoint && yamlShowValues.test(content));
}

function isErrorPage(content: string, errorhandler: string | undefined): boolean {
  return developerExceptionPage.test(content) || (errorhandler !== undefined && errorhandlerMiddleware.exec(content)?.[1] === errorhandler);
}
