import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { errorDetailsRule } from "../../src/rules/error-details.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return errorDetailsRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testErrorDetailsReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/server/errors.ts", [
      "export function handleError(err: Error, req: Request, res: Response, next: NextFunction) {",
      "  logger.error(err);",
      "  res.status(500).json({",
      "    message: err.message,",
      "    stack: err.stack",
      "  });",
      "}",
      "",
      "export function handleParseError(err: Error, req: Request, res: Response) {",
      "  res.status(400).send(err.stack);",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Error details sent to clients");
  assert.deepEqual(finding?.lines, [5, 10]);
  assert.equal(
    finding?.message,
    "Lines 5, 10 send stack traces or exception details to clients, which show whoever triggers an error file paths, library versions, queries, and sometimes secrets, and help them aim the next request."
  );
}

export function testErrorDetailsReadsEachFrameworkAndSetting(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/php.ini", ["display_errors = On"]],
    ["public/.htaccess", ["php_flag display_errors on"]],
    ["deploy/php-fpm/www.conf", ["php_admin_flag[display_errors] = on"]],
    ["public/index.php", ["<?php", "ini_set('display_errors', '1');"]],
    ["src/main/resources/application.properties", ["server.error.include-stacktrace=always"]],
    ["src/main/resources/application.yml", ["server:", "  error:", "    include-stacktrace: always", "    include-exception: true"]],
    ["Web.config", ["<system.web>", "  <customErrors mode=\"Off\" />", "</system.web>"]],
    ["Web.config", ["<httpErrors errorMode=\"Detailed\" />"]],
    ["App/Startup.cs", ["services.AddGrpc(options => options.EnableDetailedErrors = true);"]],
    ["App/appsettings.json", ["{", "  \"DetailedErrors\": true", "}"]],
    ["src/graphql.ts", ["const server = new ApolloServer({ typeDefs, resolvers, includeStacktraceInErrorResponses: true });"]],
    ["src/app.module.ts", ["GraphQLModule.forRoot<ApolloDriverConfig>({", "  driver: ApolloDriver,", "  debug: true,", "})"]],
    ["src/yoga.ts", ["const yoga = createYoga({", "  schema,", "  maskedErrors: false", "})"]],
    ["app/views.py", ["    except Exception:", "        return jsonify(error=traceback.format_exc()), 500"]],
    ["app/views.py", ["    except Exception:", "        return {\"error\": \"failed\", \"trace\": traceback.format_exc()}, 500"]],
    ["app/api.py", ["    except Exception:", "        raise HTTPException(", "            status_code=500,", "            detail=traceback.format_exc(),", "        )"]],
    ["src/main/java/com/acme/ErrorServlet.java", ["    exception.printStackTrace(response.getWriter());"]],
    ["src/main/webapp/error.jsp", ["<% exception.printStackTrace(new java.io.PrintWriter(out)); %>"]],
    ["src/main/java/com/acme/Advice.java", ["    return ResponseEntity.status(500).body(ExceptionUtils.getStackTrace(ex));"]],
    ["internal/server/recover.go", ["\t\t\thttp.Error(w, string(debug.Stack()), http.StatusInternalServerError)"]],
    ["app/controllers/application_controller.rb", ["  rescue_from StandardError do |e|", "    render json: { error: e.message, backtrace: e.backtrace }, status: 500", "  end"]],
    ["app/Exceptions/Handler.php", ["    return response()->json([", "        'message' => $e->getMessage(),", "        'trace' => $e->getTraceAsString(),", "    ], 500);"]],
    ["Api/ErrorController.cs", ["        return StatusCode(500, ex.ToString());"]]
  ];
  for (const [path, lines] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testErrorDetailsSkipsGuardedAndSafeCode(): void {
  const cases: Array<[string, string[]]> = [
    // Generic messages, and traces kept in logs.
    ["src/server/errors.ts", ["  logger.error(err.stack);", "  res.status(500).json({ message: 'Internal error' });"]],
    ["app/views.py", ["    except Exception:", "        logger.error(traceback.format_exc())", "        return jsonify(error='failed'), 500"]],
    ["src/main/resources/application.properties", ["server.error.include-stacktrace=never", "server.error.include-exception=false"]],
    ["deploy/php.ini", ["display_errors = Off", "log_errors = On"]],
    ["Web.config", ["<customErrors mode=\"RemoteOnly\" />"]],
    // An environment check before the details.
    ["src/server/errors.ts", ["  res.status(500).json({", "    message: err.message,", "    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack", "  });"]],
    ["src/server/errors.ts", ["  if (process.env.NODE_ENV !== 'production') {", "    res.status(500).send(err.stack);", "    return;", "  }"]],
    ["App/Startup.cs", ["if (env.IsDevelopment())", "{", "    services.AddGrpc(options => options.EnableDetailedErrors = true);", "}"]],
    ["public/index.php", ["<?php", "if (getenv('APP_DEBUG')) {", "    ini_set('display_errors', '1');", "}"]],
    // Debug options of other libraries, and a trace in an error message's text.
    ["src/logger.ts", ["const logger = pino({", "  debug: true", "});"]],
    ["src/server/errors.ts", ["  res.status(500).send('Set err.stack to see the trace');"]],
    // Development settings and Rails' debug page.
    ["config/php.ini-development", ["display_errors = On"]],
    ["App/appsettings.Development.json", ["{", "  \"DetailedErrors\": true", "}"]],
    ["Web.Debug.config", ["<customErrors mode=\"Off\" />"]],
    ["lib/action_dispatch/middleware/debug_exceptions.rb", ["      render(wrapper.status_code, body: exception.backtrace.join(\"\\n\"))"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testErrorDetailsSkipsTestsAndCanBeDisabled(): void {
  const lines = ["  res.status(500).send(err.stack);"];
  assert.deepEqual(findings([added("tests/server/errors.test.ts", lines)]), []);
  assert.deepEqual(findings([added("examples/express/app.js", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { errorDetails: { enabled: false } } });
  assert.deepEqual(findings([added("src/server/errors.ts", lines)], config), []);
}
