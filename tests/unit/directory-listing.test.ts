import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { directoryListingRule } from "../../src/rules/directory-listing.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return directoryListingRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testDirectoryListingReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("deploy/nginx/site.conf", [
      "server {",
      "  listen 80;",
      "  location /files/ {",
      "    root /srv/app;",
      "    autoindex on;",
      "  }",
      "  location /static/ {",
      "    autoindex on;",
      "  }",
      "}"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Directory listing turned on");
  assert.deepEqual(finding?.lines, [5, 8]);
  assert.equal(
    finding?.message,
    "Lines 5, 8 turn on directory listing in nginx, so anyone can browse every file in the served folders, including backups, uploads, source maps, and configuration files that no page links to."
  );
}

export function testDirectoryListingReadsEachServer(): void {
  const cases: Array<[string, string[], string]> = [
    ["deploy/apache/site.conf", ["<Directory /var/www/html>", "    Options Indexes FollowSymLinks", "</Directory>"], "Apache"],
    ["public/.htaccess", ["Options +Indexes"], "Apache"],
    ["deploy/httpd.conf", ["    Options All"], "Apache"],
    ["k8s/nginx-configmap.yaml", ["data:", "  default.conf: |", "    location / {", "      autoindex on;", "    }"], "nginx"],
    ["deploy/lighttpd.conf", ["dir-listing.activate = \"enable\""], "lighttpd"],
    ["Caddyfile", ["example.com {", "  root * /srv", "  file_server browse", "}"], "Caddy"],
    ["Web.config", ["<system.webServer>", "  <directoryBrowse enabled=\"true\" />", "</system.webServer>"], "IIS"],
    [
      "src/main/webapp/WEB-INF/web.xml",
      ["<init-param>", "  <param-name>listings</param-name>", "  <param-value>true</param-value>", "</init-param>"],
      "Tomcat or Jetty"
    ],
    ["src/main/java/com/acme/Server.java", ["    resourceHandler.setDirectoriesListed(true);"], "Jetty"],
    ["src/server.js", ["const serveIndex = require('serve-index');", "app.use('/uploads', express.static('uploads'), serveIndex('uploads', { icons: true }));"], "serve-index"],
    ["src/server.ts", ["import fastifyStatic from '@fastify/static';", "app.register(fastifyStatic, { root: publicDir, list: true });"], "@fastify/static"],
    ["project/urls.py", ["    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT, 'show_indexes': True}),"], "Django"],
    ["App/Program.cs", ["app.UseDirectoryBrowser();"], "ASP.NET Core"],
    ["config.ru", ["run Rack::Directory.new('public')"], "Rack"],
    ["config/routes.rb", ["  mount Rack::Directory.new(Rails.root.join('exports')), at: '/exports'"], "Rack"]
  ];
  for (const [path, lines, label] of cases) {
    const result = findings([added(path, lines)]);
    assert.equal(result.length, 1, `${path}: ${lines.join(" | ")}`);
    assert.ok(result[0]?.message.includes(`directory listing in ${label},`), `${path}: ${result[0]?.message}`);
  }
}

export function testDirectoryListingSkipsListingOffAndGuardedCode(): void {
  const cases: Array<[string, string[]]> = [
    ["deploy/nginx/site.conf", ["autoindex off;", "# autoindex on;"]],
    ["deploy/apache/site.conf", ["Options -Indexes +FollowSymLinks", "Options FollowSymLinks", "IndexOptions FancyIndexing"]],
    ["Web.config", ["<directoryBrowse enabled=\"false\" />"]],
    ["src/main/webapp/WEB-INF/web.xml", ["<init-param>", "  <param-name>listings</param-name>", "  <param-value>false</param-value>", "</init-param>"]],
    // serve-index's name without the package, and other packages' `list` options.
    ["src/server.js", ["function serveIndex(req, res) {}", "app.get('/', serveIndex);"]],
    ["lib/index.js", ["const debug = require('debug')('serve-index');", "function serveIndex(root, options) {", "  throw new TypeError('serveIndex() root path required');", "}"]],
    ["src/menu.ts", ["const menu = { list: true };"]],
    ["lib/ui/configuration.rb", ["  @template = \"#{Rack::Directory.new('').root}/swagger/index.erb\""]],
    // Development only.
    ["src/server.js", ["const serveIndex = require('serve-index');", "if (process.env.NODE_ENV === 'development') {", "  app.use('/files', serveIndex('files'));", "}"]],
    ["App/Program.cs", ["if (app.Environment.IsDevelopment())", "{", "    app.UseDirectoryBrowser();", "}"]],
    ["project/urls.py", ["if settings.DEBUG:", "    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'show_indexes': True})]"]],
    // Development setups, documentation, and examples.
    ["docker/nginx.dev.conf", ["autoindex on;"]],
    ["docs/nginx.md", ["    autoindex on;"]],
    ["examples/static/server.js", ["const serveIndex = require('serve-index');", "app.use(serveIndex('public'));"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testDirectoryListingSkipsTestsAndCanBeDisabled(): void {
  const lines = ["autoindex on;"];
  assert.deepEqual(findings([added("tests/fixtures/nginx.conf", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { directoryListing: { enabled: false } } });
  assert.deepEqual(findings([added("deploy/nginx/site.conf", lines)], config), []);
}
