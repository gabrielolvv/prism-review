# Changelog

All notable changes to Prism Review are documented in this file.

## 0.90.0 - 2026-10-31

### Added

- `public-env-secret` rule: flags, as high risk, secrets in environment variables the build copies into the JavaScript it sends to browsers, such as `NEXT_PUBLIC_STRIPE_SECRET_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `REACT_APP_CLIENT_SECRET`, or SvelteKit's `PUBLIC_JWT_SECRET`, and secrets exposed through Next.js's `env`, Vite's `define`, or webpack's `DefinePlugin` and `EnvironmentPlugin`. Public API keys and tokens, such as Firebase's API key, Stripe's publishable key, and Supabase's anonymous key, are not reported. The names are found before redaction. `credential-file` skips public variables, so this rule covers them. On about 117,000 files of library and application code, it reports none.

## 0.89.0 - 2026-10-31

### Added

- `insecure-temp-file` rule: warns about temporary file names made without creating the file, such as Python's `tempfile.mktemp()` and `os.tempnam()`, C's `tmpnam()`, `tempnam()`, and `mktemp()`, shell's `mktemp -u`, and Ruby's `Dir::Tmpname.make_tmpname`, and about writes to literal paths in `/tmp`, such as `open("/tmp/report.csv", "w")`, `fs.writeFileSync("/tmp/...")`, `os.Create("/tmp/...")`, and shell names made from `$$`. Another user on the machine can create the file, or a symbolic link with its name, first. `mkstemp()`, `NamedTemporaryFile()`, `mktemp` and `mktemp -d`, PHP's `tempnam()`, and paths built from a value are not reported. On about 117,000 files of library and application code, it reports one: libxml2's `tempnam()`, vendored by libxmljs2.

## 0.88.0 - 2026-10-31

### Added

- `mobile-security` rule: reports Android and iOS settings that weaken transport security or open WebViews. High: `handler.proceed()` in `onReceivedSslError`, `android:debuggable="true"`, and WebView file access from `file://` URLs. Warning: `usesCleartextTraffic="true"`, `cleartextTrafficPermitted="true"` on `<base-config>`, `NSAllowsArbitraryLoads`, user certificate authorities outside `<debug-overrides>`, `MIXED_CONTENT_ALWAYS_ALLOW`, and WebView remote debugging, including react-native-webview props and Expo and Capacitor settings. Settings behind a condition or debug check, as libraries put them, are not reported. On about 18,000 files of React Native, Capacitor, Cordova, and Expo packages, and the other 99,000 files of library and application code, it reports none.

## 0.87.0 - 2026-10-31

### Added

- `debug-endpoint` rule: reports diagnostic endpoints and debuggers exposed outside development. High: Spring Boot Actuator's `exposure.include` with `*`, `env`, `heapdump`, `shutdown`, or the other endpoints that show settings or memory, `show-values: ALWAYS`, and Boot 1's `management.security.enabled=false`, and the Node.js inspector on `--inspect=0.0.0.0`. Warning: `import _ "net/http/pprof"`, ASP.NET Core's `UseDeveloperExceptionPage()` and the `errorhandler` middleware without an environment check, `introspection: true` in a GraphQL server, and `phpinfo()`. Development settings, benchmarks, and introspection left to a plugin are not reported. On about 99,000 files of library and application code, it reports none.

## 0.86.0 - 2026-10-31

### Added

- `security-headers` rule: warns when a change turns off or weakens a security header, such as helmet's `contentSecurityPolicy: false`, `frameguard: false`, or `hsts: false`, `res.removeHeader("X-Frame-Options")`, Django's `SECURE_SSL_REDIRECT = False`, `SECURE_HSTS_SECONDS = 0`, and `@xframe_options_exempt`, Flask-Talisman's `content_security_policy=None`, Rails' `config.force_ssl = false`, Spring Security's `frameOptions().disable()` and `headers().disable()`, and a Content-Security-Policy whose `script-src` or `default-src` allows `'unsafe-inline'`, `'unsafe-eval'`, or `*`. Development, example, and test settings, Django's defaults file, and docstrings are not reported. On about 99,000 files of library and application code, it reports one: Directus's `'unsafe-eval'` in `scriptSrc`.

## 0.85.0 - 2026-10-31

### Added

- `weak-tls` rule: warns about TLS settings that allow SSL 3, TLS 1.0, or TLS 1.1, such as `minVersion: "TLSv1"`, `ssl.SSLContext(ssl.PROTOCOL_TLSv1)`, `MinVersion: tls.VersionTLS10`, `SSLContext.getInstance("TLSv1.1")`, `SecurityProtocolType.Tls11`, `CURL_SSLVERSION_TLSv1_0`, nginx's `ssl_protocols TLSv1 TLSv1.1`, Apache's `SSLProtocol all` without `-TLSv1`, Spring's `enabled-protocols`, AWS's `ELBSecurityPolicy-2016-08`, and CloudFront's `TLSv1_2016`, and cipher lists that add RC4, DES, NULL, export, or anonymous suites. Python compatibility tables, docstrings, and suites removed with `!` are not reported. On about 99,000 files of library and application code, it reports none.

## 0.84.0 - 2026-10-31

### Added

- `jwt-without-expiry` rule: warns about JSON Web Tokens issued without an expiry, such as `jwt.sign({ username }, secret)`, `new SignJWT(claims)` without `setExpirationTime`, `jwt.encode({"sub": id}, key)`, `jwt.NewWithClaims(method, jwt.MapClaims{...})` without `"exp"`, `Jwts.builder()` without `setExpiration`, `JWT.create()` without `withExpiresAt`, and `new JwtSecurityToken(...)` without `expires:`. A token that leaks then works for as long as the signing key does. Claims and options held in a name are not reported, since they may set the expiry elsewhere. The calls are found before redaction, which rewrites lines such as `const token = jwt.sign({`. On about 99,000 files of library and application code, it reports one: Uptime Kuma's login tokens.

## 0.83.0 - 2026-10-31

### Added

- `hardcoded-session-secret` rule: reports, as high risk, session and cookie signing keys set to text written in the code, such as `session({ secret: "..." })`, `cookieParser("...")`, Koa's `app.keys`, iron-session's `password`, Flask's `app.secret_key`, Django's `SECRET_KEY`, Rails' `secret_key_base`, Sinatra's `session_secret`, Phoenix's `secret_key_base`, and Go's `sessions.NewCookieStore([]byte("..."))`. Anyone who can read the code can make a cookie for any user, and with Flask, Django, and Rails a forged cookie can run code on the server. Keys read from the environment, template placeholders, docstrings, tests, and example apps are not reported. On about 99,000 files of library and application code, it reports one: the configuration Flask-AppBuilder ships for new apps.

### Changed

- Redaction also hides values assigned to `secret_key`, `secret_key_base`, and `session_secret`, such as Django's `SECRET_KEY = "..."`, which were shown in the review before.

## 0.82.0 - 2026-10-31

### Added

- `weak-password-hashing` rule: warns about bcrypt with a cost below 10, PBKDF2 with fewer than 100,000 iterations, and scrypt with N below 2^14, such as `bcrypt.hash(password, 8)`, `crypto.pbkdf2Sync(password, salt, 1000, 32, "sha256")`, `hashlib.pbkdf2_hmac("sha256", pw, salt, 10_000)`, `new PBEKeySpec(pw, salt, 1024, 256)`, `new Rfc2898DeriveBytes(pw, salt, 1000)`, `bcrypt.GenerateFromPassword(pw, bcrypt.MinCost)`, or `password_hash($pw, PASSWORD_BCRYPT, ['cost' => 6])`. With too little work, a leaked hash can be guessed far faster on a GPU. It reads numbers written in the call and constants assigned in the same patch, not values from configuration, and skips test files, which lower the cost on purpose. On about 99,000 files of library and application code, it reports three: encrypt-with-password's single PBKDF2 iteration, Spring Security's `AesBytesEncryptor` with 1,024 iterations, and Flyway's license encryption with 65,536.

## 0.81.0 - 2026-10-31

### Added

- `command-injection` rule: reports, as high risk, commands run with a value from the request in the program or in the text a shell parses, such as ``exec(`ping ${req.query.host}`)``, `os.system("ping " + request.args["host"])`, `subprocess.check_output(f"dig {host}", shell=True)`, Ruby's `` `whois #{params[:domain]}` ``, PHP's `shell_exec('ping ' . $_GET['host'])`, `Runtime.getRuntime().exec(...)`, Go's `exec.Command("sh", "-c", ...)`, and `Process.Start("cmd.exe", "/c ..." + Request.Query["host"])`. `risky-api` warns about every call that starts a shell; this rule reports the ones a request value reaches. A fixed program with the request value as a separate argument and no shell, values quoted with `shlex.quote`, `escapeshellarg`, or `Shellwords.escape`, and values turned into numbers are not reported. On about 99,000 files of library and application code, it reports none.

## 0.80.0 - 2026-10-31

### Added

- `unsafe-reflection` rule: reports, as high risk, modules, classes, and methods loaded or called by a name that comes from the request, such as `require(req.query.name)`, `res[req.query.output](result)`, `importlib.import_module(request.GET["module"])`, `getattr(handlers, action)`, Rails' `params[:type].constantize` and `send(params[:method])`, `Class.forName(request.getParameter("type"))`, `Type.GetType(Request.Query["type"])`, PHP's `call_user_func($_GET['callback'])` and `new $class()`, and Go's `MethodByName(r.FormValue("action"))`. The request then chooses the code that runs. It follows names assigned from the request, and skips names checked against an allowlist, looked up in a table of fixed functions such as `handlers[name]`, or limited by a fixed prefix such as `f"on_{name}"`. On about 99,000 files of library and application code, it reports four: mongodb-rest, next-auth, NodeBB, and Rails' actionable exceptions.

## 0.79.0 - 2026-10-31

### Added

- `electron-security` rule: reports, as high risk, Electron windows that give web content Node.js or turn off its protections: `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`, `appendSwitch("ignore-certificate-errors")` or `"disable-web-security"`, a `certificate-error` handler or `setCertificateVerifyProc` that accepts every certificate, and `<webview nodeintegration>` or `disablewebsecurity`. With them, a script injected into the page through XSS or a loaded URL can run commands on the user's computer. `sandbox: false`, `allowRunningInsecureContent: true`, `experimentalFeatures: true`, `enableRemoteModule: true`, and the `no-sandbox` switch are reported as warnings. Settings are read as properties or quoted keys, not in text that mentions them, and only in files that show Electron. On about 40 npm packages that open Electron windows, it reports the helpers known for these settings, such as electron-prompt, electron-about-window, and electron-dialogs, and electron-vite's templates; on about 98,000 files of other code, it reports none.

## 0.78.0 - 2026-10-31

### Added

- `regex-injection` rule: warns when a regular expression is compiled from a request value without escaping it, as in `new RegExp(req.query.q)`, `re.compile(request.args["q"])`, `Regexp.new(params[:q])`, `Pattern.compile(request.getParameter("q"))`, `Regex.IsMatch(name, Request.Query["q"])`, `preg_match('/' . $_GET['q'] . '/', ...)`, a Django `title__iregex=q` lookup, or a MongoDB `{ $regex: req.query.name }` filter. A request can then send a pattern such as `(a+)+$` that takes exponential time to fail (ReDoS), or `.*` that matches every record. It follows names assigned or destructured from the request, and skips values escaped with `escapeRegExp`, `re.escape`, `Regexp.escape`, `Pattern.quote`, `Regex.Escape`, or `preg_quote`. On about 98,000 files of library and application code, it reports none.

## 0.77.0 - 2026-10-31

### Added

- `zip-slip` rule: warns when the entries of a zip or tar archive are written to a path built from the entry's own name, such as `path.join(dest, entry.path)`, `filepath.Join(dest, f.Name)`, `os.path.join(dest, member.name)`, `new File(dir, entry.getName())`, or `Path.Combine(dest, entry.FullName)`, without a check that the path stays in the destination, so an entry named `../../etc/cron.d/job` is written outside it. It reads JavaScript, TypeScript, Python, Go, Java, Kotlin, C#, and Ruby, follows names assigned from an entry, and also reports Python `tarfile` extraction without a `filter`. Paths checked nearby with `startsWith`, `HasPrefix`, `getCanonicalPath`, `path.relative`, or a helper such as `sanitizeExtractPath`, and names reduced with `basename`, are not reported. On versions of adm-zip, unzipper, zt-zip, zip4j, plexus-archiver, and codeclysm/extract with a known Zip Slip vulnerability, it reports the extraction code, and on the fixed versions it does not, except zt-zip's `Zips` builder, which still joins entry names without a check; on about 95,000 files of other library and application code, it reports one file.

## 0.76.0 - 2026-10-31

### Changed

- `risky-api` no longer reports comment lines, such as a commented-out `os.system(...)` or a JSDoc example that calls `exec()`, text inside Python's triple-quoted strings, such as a docstring that mentions ``eval()``, or lines over 1,000 characters, which hold minified or bundled code such as jQuery or a built admin panel.
- On about 95,000 files of library and application code, the rule now reports 222 files instead of 289, before leaving out the default vendored paths added in 0.74.0.

## 0.75.0 - 2026-10-31

### Changed

- `blanket-suppression` no longer reports Python markers on lines where they can only turn off one check: a bare `# noqa` or `# type: ignore` on an import line, which keeps a re-export (F401), an import below code (E402), or a module without type stubs, and a bare `# noqa` after text in a comment or on the line that closes a long triple-quoted string, which can only cover the line's length (E501). `# flake8: noqa`, a `# type: ignore` on a line of its own, and a `# noqa` on the line that opens a string are still reported.
- On about 95,000 files of library and application code, the rule now reports 602 files instead of 786.

## 0.74.1 - 2026-10-31

### Fixed

- Findings below a line that ends in a key such as `token:` or `password =`, with the value on the next line, are reported on the right line. Redaction allowed a line break after the separator, so it joined the next line to that one, and every finding further down the file was reported one line too early, including line comments and annotations. About 0.45% of files in a corpus of library code had such a line, among them Django's `contrib/auth/forms.py` and httpx's client.

## 0.74.0 - 2026-10-31

### Changed

- With `ignoreGenerated`, the default, files under `vendor/`, `vendors/`, `third_party/`, `3rdparty/`, `node_modules/`, `bower_components/`, or `dist/`, at any depth, and minified `.min.js` and `.min.css` files, are left out of the noise rules like files marked `linguist-vendored`. GitHub's Linguist treats these paths as vendored and collapses them in diffs; they hold copies of dependencies and build output, whose source is reviewed where it is written. `-linguist-vendored` in `.gitattributes` brings a path back into the review, as it does on GitHub. Secret, hidden Unicode, credential file, workflow, and configuration checks still read these files.
- The summary counts these files, and the ones `.gitattributes` marks, as "generated or vendored". It said "marked generated or vendored in .gitattributes" before.
- On about 95,000 files of library and application code, about 300 of 2,030 findings were in these paths, most of them from `risky-api`, `destructive-migration` in compiled migrations, and `mass-assignment` in bundles.

## 0.73.0 - 2026-10-31

### Changed

- `timing-unsafe-comparison` no longer reports the same field of two stored objects, or of two versions of one, such as `existingActiveGift.token !== gift.token`, `a.refreshToken === b.refreshToken`, or Ghost's `this.previous('secret') !== this.get('secret')`, unless a side reads the request. One function applied to two values, as in `_hmac(key, a) != _hmac(key, b)`, is still reported.
- It also skips `JSON.stringify(...)` on both sides, Babel's and TypeScript's re-export helpers (`exports[key] === _token[key]`), React Compiler's memo cache (`$[8] !== token`), and mocks and test values such as `mockAccessTokenExpiredError`.
- PHP's `->` is read as a member access, so `$token->getLine()` is about a token rather than its value.
- On about 95,000 files of library and application code, the rule now reports 37 files instead of 57. Those left include Ghost's unsubscribe and member HMAC checks, next-auth's CSRF check, Werkzeug's debugger PIN, and Tomcat's AJP secret.

## 0.72.0 - 2026-10-31

### Changed

- `nosql-injection` no longer reports calls on a service or repository, such as `service.updateMany(req.body.keys, req.body.data)` in Directus, `getService("user").exists(...)` in Strapi, or `app.service("users").find(...)` in Feathers, since these layers take keys or their own query format and validate it. A Mongoose model named `Service` is still read.
- `nosql-injection` no longer reports filters wrapped in `where`, as in `User.findOne({ where: { email: req.body.email } })`, which is how Sequelize, TypeORM, and Prisma query, and they do not read `$ne` from a plain object.
- On about 95,000 files of library and application code, the rule now reports no file instead of 23, all of them Directus and Strapi controllers.

## 0.71.0 - 2026-10-30

### Changed

- `secret-in-diff` no longer reports private keys under `test/`, `tests/`, `testdata/`, `fixtures/`, `test-fixtures/`, `__tests__/`, `__mocks__/`, `spec/`, `examples/`, `samples/`, `demos/`, `docs/`, or `testcerts/`, in test files, or in documentation, because tests and examples that show TLS or signing generate a throwaway key. GitHub tokens, OpenAI-style keys, and AWS access key IDs are still reported in every file. On about 95,000 files of library and application code, the rule now reports 2 files instead of 102: the key Netty embeds in its source, and a test module outside a test directory.

### Fixed

- On a private key header's line, the key material must follow the header. A minified bundle that checks whether a string starts with the header, such as auth0-spa-js, was reported as a key because of a long name further on the line.
- A whole key in one string, such as the `private_key` of a service account's JSON with its END line on the same line, is now reported. The material was looked for after the last `-----` of the line, which is past the END line.

## 0.70.0 - 2026-10-30

### Changed

- The SARIF report ranks security alerts. Rules about secrets, the supply chain, infrastructure, and code carry the `security` tag and a `security-severity`, 8.0 when they reported a high-risk finding and 5.0 for a warning, so code scanning shows their alerts as High or Medium and branch protection can block merging on them. Rules about tests and the size of the review carry a `problem.severity` instead. Each rule that reported a finding has a `defaultConfiguration.level`.
- A finding on several lines lists its other lines as `relatedLocations` of the same alert, instead of pointing only to the first line.
- Each rule in the SARIF report has a `fullDescription` and `help`, in text and Markdown, that links to its section in `docs/configuration.md`, which code scanning shows on each alert.
- The report was checked against the SARIF 2.1.0 schema.

## 0.69.0 - 2026-10-30

### Added

- `admin-route-auth` rule: warns about routes under `/admin`, `/internal`, `/backoffice`, `/staff`, or `/manage` registered with no authentication or role check, such as `router.delete("/admin/users/:id", deleteUser)` or a Flask `@app.route("/admin/...")` without `@login_required`. It reads Express, Koa, Fastify, Hono, Flask, Quart, Go routers, and Laravel, and counts middleware, decorators, groups, file-wide hooks such as `router.use(authenticate)` or `before_request`, and checks at the start of the handler. In a changed file, an unguarded route only counts when another route in the patch is guarded, since protection may sit in another file. On eight applications with admin APIs, such as Medusa, Directus, Ghost, NodeBB, Strapi's admin, and Verdaccio, and on about 83,000 files of library code, it reports none.

## 0.68.0 - 2026-10-30

### Added

- `plaintext-password` rule: reports, as high risk, a stored password field compared directly with the password a user typed, such as `user.password === req.body.password`, `row["password"] != password`, `$user["password"] == $_POST["password"]`, or `user.getPassword().equals(password)`, which means passwords are stored in plain text. It reads JavaScript, TypeScript, Python, Ruby, Go, Java, Kotlin, C#, and PHP. Lines that hash or verify, hashed and confirmation fields, form fields compared with each other, presence checks, and equals methods are not reported. On about 83,000 files of library code, it reports one: mongodb-rest, which checks logins against passwords kept in plain text.

## 0.67.0 - 2026-10-30

### Added

- `static-iv` rule: warns about encryption with an IV or nonce that is the same every time, such as `createCipheriv("aes-256-cbc", key, Buffer.alloc(16))`, `new IvParameterSpec("1234567890123456".getBytes())`, `modes.CBC(b"\x00" * 16)`, or a Go nonce from `make([]byte, 12)` passed to `gcm.Seal` without `io.ReadFull(rand.Reader, ...)`. It reads Node.js crypto, WebCrypto, pyca/cryptography, PyCryptodome, Java, Go, .NET, PHP OpenSSL and libsodium, and Ruby OpenSSL, and follows names assigned a fixed value unless they are filled with random bytes. On 22 encryption wrappers, such as cryptr, simple-encryptor, iron, django-cryptography, and spring-security-crypto, all of which make random IVs, and on about 81,000 files of other library code, it reports none.

## 0.66.0 - 2026-10-30

### Added

- `log-injection` rule: warns about request values from query strings, bodies, forms, and cookies written into the text of a log or console line, where a line break can add fake entries, such as ``logger.info(`Failed login for ${req.body.username}`)``, `logging.info("Search: %s", request.args.get("q"))`, or `log.trace("Authenticating username '" + username + "'")` after `username = request.getParameter("j_username")`. It reads the log calls `secret-logging` reads and follows names assigned a request value. Structured fields, whole request objects, values cleaned of line breaks or quoted (`%r`, `!r`, `%q`, `JSON.stringify`), URLs, headers, route parameters, and names inside string text are not reported. On about 81,000 files of library code, it reports four, such as Tomcat's form login and Spring's locale interceptor, which log the submitted username and locale.

## 0.65.0 - 2026-10-30

### Added

- `reflected-xss` rule: warns about request values written straight into an HTML response, such as ``res.send(`<h1>Hello ${req.query.name}</h1>`)``, `return f"<h1>Hello {name}</h1>"` in a Flask route after `name = request.args.get("name")`, `echo $_GET["q"]`, `fmt.Fprintf(w, ..., r.URL.Query().Get("q"))`, or `response.getWriter().println(request.getParameter("q"))`. It reads Express, Flask, Django, PHP, Go's net/http, servlets and JSP, and ASP.NET, and follows names assigned a request value or text built from one. Escaped values, rendered templates, JSON and plain-text responses, returned dicts, and Python returns outside a route are not reported. On about 78,000 files of library code, it reports one: Eve's JSONP response, which writes the callback name from the query string into the body without checking it.

## 0.64.0 - 2026-10-30

### Added

- `upload-filename` rule: warns about uploads saved or placed in a path under the file name the client sent, which can hold `../`, replace another file, or end in `.php` or `.html`, such as `f.save(os.path.join(UPLOADS, f.filename))`, multer's `cb(null, file.originalname)`, `move_uploaded_file($tmp, "uploads/" . $_FILES["f"]["name"])`, or `file.transferTo(new File(dir, file.getOriginalFilename()))`. It reads Flask, multer, express-fileupload, PHP, Laravel, Spring, the Servlet API, Go, ASP.NET Core, and Rails, and follows names assigned from the client's name. Names reduced with `secure_filename`, `basename`, `FilenameUtils.getName`, `filepath.Base`, `Path.GetFileName`, or by taking what follows the last slash, and names the server makes, are not reported. On 20 upload libraries, such as multer, formidable, busboy, Uppy Companion, Strapi's upload plugin, Flask-Reuploaded, Flask-Admin, django-filer, and gin, and on about 75,000 files of other library code, it reports none.

## 0.63.0 - 2026-10-30

### Added

- `ldap-xpath-injection` rule: warns about LDAP filters and XPath expressions built by inserting values into their text, such as `"(uid=" + username + ")"`, `f"//user[name='{name}']"`, or `fmt.Sprintf("(uid=%s)", user)`, when the text reaches an LDAP search or XPath query on the same line or through a variable within 20 lines. It reads JNDI, Spring LDAP, UnboundID, python-ldap, ldap3, PHP's LDAP functions, ldapjs, .NET's DirectorySearcher, and go-ldap, and XPath in Java, lxml, Nokogiri, REXML, PHP's DOMXPath, the `xpath` package, .NET, and the browser. Escaped values, JNDI filter arguments such as `{0}`, bound XPath variables, CSS selectors, and operators inside string text are not reported. On about 75,000 files of library code, it reports none.

## 0.62.0 - 2026-10-30

### Added

- `prototype-pollution` rule: warns about recursive merge, extend, and clone functions added in JavaScript or TypeScript that write into their target by key and go down into `target[key]` without checking for `constructor` or `prototype`, including jQuery-style functions that take their target from `arguments`, and about assignments such as `config[section][key] = value` where a key comes from the request. Skipping only `__proto__` does not count as a check for merges, since `{"constructor": {"prototype": ...}}` reaches the same place. Merges that write into a new object or a copy are not reported. On 26 packages at versions with prototype pollution advisories, it reports 11, such as deep-extend 0.5.0, extend 3.0.1, jQuery 3.3.1, assign-deep 0.4.7, merge-deep 3.0.1, and node.extend 1.1.6; on about 75,000 files of current library code, it reports three files, the unguarded recursive copies in fast-xml-parser and Apostrophe.

## 0.61.0 - 2026-10-30

### Added

- `template-injection` rule: reports, as high risk, templates compiled from text that comes from the request, directly or through a name assigned from it up to 30 lines before, such as `render_template_string("<h1>Hello " + name + "</h1>")` after `name = request.args.get("name")`, `ejs.render(req.body.template)`, or `render inline: params[:template]`. It reads Flask, Jinja, Django, Mako, EJS, Handlebars, Pug, Nunjucks, Lodash, doT, ERB, Haml, Slim, Twig, Blade, Smarty, Velocity, FreeMarker, and Go templates, and only the argument that holds the template text, so request values passed as template variables are not reported. On about 73,000 files of library code, it reports none.

## 0.60.0 - 2026-10-30

### Added

- `nosql-injection` rule: warns about request bodies and query strings used as MongoDB filters, or as values in them, without a cast to text or `$eq`, such as `User.findOne({ email: req.body.email, password: req.body.password })`, where `{"$ne": null}` matches any password, and about `$where` expressions built from text. It reads Mongoose and the MongoDB drivers for Node.js, PyMongo and Motor, and the MongoDB PHP library, and follows names destructured from the request and objects taken from it a few lines before the query. Route parameters, Flask's `request.args`, casts, `$eq`, and values passed through a function such as a validator are not reported; `JSON.parse` and `json.loads` still count. On 24 packages built on MongoDB, such as Parse Server, Apostrophe, mongo-express, Feathers, Eve, Beanie, and MongoEngine, and on the 53,000 files of other library code, it reports none.

## 0.59.0 - 2026-10-30

### Added

- `postmessage-origin` rule: warns about `postMessage` calls to another window with `*` as the target origin, and `window` message listeners whose handler never checks `event.origin` or `event.source`, in JavaScript, TypeScript, Vue, Svelte, and HTML. Handlers passed by name are read where the patch defines them, and checks through a helper such as `sanitize(e, origin)` count. Workers, ports, WebSockets, and a window posting to itself are not reported. On 27 browser packages that use cross-window messages, such as Keycloak, MSAL, auth0-spa-js, oidc-client-ts, Stripe, PayPal, Braintree, Teams, penpal, post-robot, and iframe-resizer, it reports two: frame-messenger, which posts to iframes with `*`, and Postmate, whose reply handler does not check the sender. On the 45,000 files of other library code, it reports none.

## 0.58.0 - 2026-10-30

### Added

- `timing-unsafe-comparison` rule: warns about signatures, HMACs, tokens, and API keys compared with `==`, `===`, `equals`, `bytes.Equal`, or `strcmp`, which stop at the first difference and let an attacker find the expected value by timing the check, in JavaScript, TypeScript, Python, Ruby, Go, Java, Kotlin, C#, and PHP. Constant-time comparisons, checks for a missing token or its length or type, fixed values and enum members, lexer, page, and cancellation tokens, OpenID nonces, `equals` methods, and lexer and parser files are not reported. The comparisons are found before redaction. On about 45,000 files of library code, it reports 23 files, about half of them real, such as Tomcat's AJP secret check, Spring Security's remember-me and digest checks, the Werkzeug debugger's PIN check, next-auth's CSRF check, and pysaml2's cookie signatures.

## 0.57.0 - 2026-10-30

### Added

- `unescaped-html` rule: warns about template output and calls that write a value into HTML without escaping it, such as Vue's `v-html`, Svelte's `{@html}`, Angular's `bypassSecurityTrustHtml`, Jinja and Django's `|safe` and `{% autoescape off %}`, Twig's `|raw`, Blade's `{!! !!}`, Handlebars' `{{{ }}}`, EJS's `<%-`, ERB's `<%==`, Haml, Slim, and Pug's unescaped output, Thymeleaf's `th:utext`, JSP's `escapeXml="false"`, and Python's `mark_safe` and `Markup`. Text written in the template, values already escaped such as `| tojson | safe`, Django's `help_text|safe`, layouts such as `{{{body}}}`, includes, and lines marked `# nosec` are not reported. On about 43,000 files of library code, it reports 46 files, almost all in Django, Django REST framework, and Flask-AppBuilder, where these calls are how the frameworks build their own HTML.

## 0.56.0 - 2026-10-30

### Added

- `url-credentials` rule: reports, as high risk, URLs with a password in them, such as database, Redis, MongoDB, AMQP, or Git connection strings, in code, Docker Compose files, Helm values, Spring properties, and other text files. Template syntax such as `${DB_PASSWORD}` or `{{ .Values.password }}`, placeholders, local development defaults such as `postgres:postgres`, documentation pairs such as `scott:tiger`, very short passwords, `localhost`, and example hosts are not reported. Environment and package manager files stay with `credential-file`. On about 43,000 files of library code, it reports none.

### Changed

- Redaction replaces the password of each reported URL, so a review shows `postgres://app:[REDACTED]@db.acme.io/app`.

## 0.55.0 - 2026-10-29

### Added

- `secret-logging` rule: warns about log and console calls that write a value named like a password, token, API key, or other secret, such as `logger.info(user.password)`, `` console.log(`Bearer ${token}`) ``, or `log.debug(f"token={token}")`, in JavaScript, TypeScript, Python, Ruby, Go, Java, Kotlin, C#, and PHP. Text inside quotes and names that describe a secret, such as `passwordLength` or `password.length`, are not reported. The values are found before redaction, which would otherwise hide them. On about 43,000 files of library code, it reports 15 files, such as Authlib's debug logs of issued OAuth tokens and Tomcat's command-line tool that prints a credential.

## 0.54.0 - 2026-10-29

### Added

- `extends` in `.prism-review.yml` reads another configuration first and lays this one over it, so an organization can keep one set of rules for many repositories. It takes a file in the same repository, read from the pull request's base commit, or `owner/repo/path@ref` in another repository, read with the action's token. Mappings merge key by key, and lists and values replace the extended ones; files can extend each other up to five deep. A file that cannot be read fails the run instead of falling back to the defaults.
- `config-change` reports pull requests that change a file the configuration extends in the same repository, as it does for the configuration itself.
- The CLI follows `extends` too, reading other repositories through the GitHub API with `GITHUB_TOKEN` or `GH_TOKEN` when one is set.

## 0.53.0 - 2026-10-29

### Added

- `insecure-web-config` warns about cookies with SameSite set to None, which other websites send with their requests, as cross-site request forgery needs: `sameSite: "none"` or `false` in Express and cookie libraries, Django's `SESSION_COOKIE_SAMESITE = "None"` and `CSRF_COOKIE_SAMESITE = "None"`, Rails' `same_site: :none` and `cookies_same_site_protection = :none`, ASP.NET Core's `SameSiteMode.None`, Spring's `sameSite("None")` and `server.servlet.session.cookie.same-site=none`, and PHP's `'samesite' => 'None'` and `session.cookie_samesite`.

### Fixed

- `insecure-web-config` no longer reports Flask's `app.run(debug=True)` in example, demo, sample, development, and test paths, as it already did not for Django's `DEBUG = True`. On Flask-AppBuilder, it reported 15 example apps.

## 0.52.0 - 2026-10-29

### Added

- `redos` rule: warns about regular expressions with a repeated group that can match the same text in many ways, such as `(\w+\s?)*`, `([a-z]+\.?)+`, or `(.*,)+`, which take exponential time on a crafted input (ReDoS). It reads regular expression literals and the regex calls of JavaScript, TypeScript, Python, Ruby, Java, Kotlin, Scala, C#, and PHP, and leaves out Go and Rust, whose engines match in linear time. A group whose repetitions start with a required part the repeated part cannot match, as in `(\d+,)*` or `([01]_*)+`, is not reported. On 24 old npm packages with ReDoS advisories, it finds brace-expansion's CVE-2017-18077, marked 0.3.6's paragraph pattern, and highlight.js 10.4.0's GAMS grammar, and on the corpora of about 40,000 files of npm, PyPI, RubyGems, Go, and Java code it reports nothing.

## 0.51.0 - 2026-10-29

### Added

- `mass-assignment` rule: warns about code that lets a request set every field of a model, such as a role or an owner. It reads Rails' `permit!` and `params.to_unsafe_h`, Django's and Django REST framework's `fields = "__all__"` in forms and serializers, Laravel's empty `$guarded` and `Model::unguard()`, models created or updated from the whole request body in Express (`User.create(req.body)`, `create({ data: req.body })`, `Object.assign(user, req.body)`) and Python (`User(**request.json)`, `create(**request.POST)`), and ASP.NET's `TryUpdateModel` without a list of properties. On the three corpora, about 39,000 files of npm, PyPI, RubyGems, Go, and Java code, plus Django REST framework, django-filter, django-allauth, Devise, ActiveAdmin, Administrate, and Mongoose, it reports only the framework code that does what the rule describes, such as Django's admin forms with `fields = "__all__"`.

## 0.50.0 - 2026-10-29

### Fixed

False positives found by running every rule over about 18,600 files from 20 popular Go modules and 18 Java libraries, such as gin, gRPC, pgx, golang-jwt, Spring, Hibernate, Tomcat, Netty, and Liquibase:

- `secret-in-diff` reports a private key header only when base64 key material follows it, on the same line or within the next six lines, so the header constants TLS libraries such as Netty and Tomcat write keys with are not reported. AWS's documented example key ID, `AKIAIOSFODNN7EXAMPLE`, is not reported either.
- `sql-injection` reads concatenation the way it reads interpolation: SQL joined only with constants, such as `TABLE_NAME`, or calls whose names start with `quote` or `escape`, such as Liquibase's `escapeTableName(...)`, is not reported.
- `risky-api` does not report Ruby's `system`, `exec`, and `spawn` given the command and its arguments as separate strings, which run without a shell.
- `disabled-security-check` skips the lines that define a switch, such as golang-jwt's `func (p *Parser) ParseUnverified(` and HttpClient's `public class NoopHostnameVerifier`.
- `weak-crypto` no longer reads Java's `"RSA/ECB/..."` transformations as ECB mode.
- `insecure-web-config` reports `setSecure(false)` only on a variable named like a cookie, so Tomcat's `request.setSecure(false)` is not reported.
- `lookalike-dependency` does not report a name that differs from a popular one by a digit, such as `rxjava2` and `rxjava3`, which is usually another major version.

On that corpus, `secret-in-diff` reports 33 files instead of 39, `sql-injection` 14 instead of 19, `risky-api` 9 instead of 13, `weak-crypto` 1 instead of 2, and `insecure-web-config` and `lookalike-dependency` none. On the earlier corpus of npm, PyPI, and RubyGems packages, `secret-in-diff` reports one file less, and the other rules are unchanged.

### Changed

- The README's pre-commit and GitLab CI examples pin this release, and a test keeps them on the version in `package.json`.

## 0.49.0 - 2026-10-29

### Added

- `--format text` prints a compact review for a terminal: the risk level and summary, then one entry per finding, most severe first, with its severity, `path:line`, title, rule, and message. It is the default when the output is a terminal, and is colored unless `NO_COLOR` is set; `FORCE_COLOR=1` colors it in a pipe. Control, invisible, and bidirectional characters in file names and finding text are printed as escapes, so a pull request cannot send escape sequences to the terminal.

### Changed

- The pre-commit hook prints text instead of Markdown. Piped or redirected output stays Markdown unless `--format` says otherwise.

## 0.48.0 - 2026-10-29

### Fixed

False positives that remained on the corpus of about 16,000 files from 39 popular packages:

- The default `rules.missingTests.testGlobs` include the `test/`, `tests/`, and `spec/` directories and Django's `tests.py`, so Mocha's `test/*.js`, pytest helpers, and RSpec support files count as tests. Rules that skip test files, such as `risky-api` and `destructive-migration`, now skip them, and `skipped-tests` and `missing-tests` count them as tests. `risky-api` reports 95 files instead of 116.
- `destructive-migration` reads code files only when they are named the way migration tools name them, starting with a number or timestamp, or in Alembic's `versions/` directory, so migration framework code such as Django's `autodetector.py` is not read as a migration. It also skips class and method definitions, `raise` lines, and Ruby symbols such as `:remove_column`. It reports 1 file instead of 18: Django's own `contenttypes` migration, which does remove a field.
- `sql-injection` no longer reads `%`, `+`, or `.format` inside a string as building it, so a placeholder template such as `"%(field)s = VALUES(%(field)s)"` is not reported, and skips template literals, Ruby strings, and Python `%` whose every inserted value goes through the database's quoting, such as `quote_name(...)` or `this.quoteTable(...)`. It reports 11 files instead of 15.

### Changed

- With the wider test globs, `skipped-tests` checks more test files. On the corpus it reports 25 more files, all Django `tests.py` files with `skipIf` or `skipUnless` markers, which the rule reports by design.

## 0.47.0 - 2026-10-29

### Added

- `prism-review analyze --staged` reviews the changes staged for the next commit, and `--base <ref>` reviews a branch since it left `<ref>`, such as `origin/main`. Both run `git diff` without colors or external diff tools, and pass when there is nothing to review.
- `--fail-on never|warning|high` sets the CLI's exit status, taking precedence over `check.failOn`.
- `.pre-commit-hooks.yaml`, so the [pre-commit](https://pre-commit.com) framework can run Prism Review on staged changes and block commits with high-risk findings, or on a branch before each push.
- A GitLab CI job in `examples/gitlab/.gitlab-ci.yml` that reviews merge requests against their target branch, and README sections on pre-commit, Git hooks, and GitLab CI.

## 0.46.0 - 2026-10-29

### Added

- `hardcoded-jwt-secret` rule: warns about JSON Web Tokens signed or verified with a key written in the code, such as `jwt.sign(payload, "change-me")`, which `secret-in-diff` misses since the key has no known format. It reads jsonwebtoken, PyJWT, ruby-jwt, firebase/php-jwt, java-jwt, jjwt, golang-jwt, and .NET's `SymmetricSecurityKey`, and skips keys from variables or the environment, interpolated strings, and public keys. The keys are found before redaction, which rewrites lines such as `const token = jwt.sign(...)` because of the variable's name. On about 800 files from JWT libraries, such as jsonwebtoken, jose, PyJWT, Authlib, ruby-jwt, and devise-jwt, it reports nothing after skipping Python doctest examples.

## 0.45.0 - 2026-10-29

### Added

- `xml-external-entities` rule: warns about XML parser settings that turn on DTDs or external entities, which let a document read local files or reach internal hosts (XXE). It reads lxml and Python's SAX parser, Java's DocumentBuilderFactory, SAXParserFactory, XMLInputFactory, and TransformerFactory, PHP's libxml, .NET's XmlReaderSettings and XmlDocument, libxmljs, Nokogiri, and libxml-ruby. On about 1,500 files from XML and SAML libraries, such as defusedxml, zeep, python3-saml, ruby-saml, Nokogiri, and xml2js, it reports only defusedxml's own example of the unsafe PHP flag.

## 0.44.0 - 2026-10-29

### Added

- `prism-review init` sets up a repository: it adds `.github/workflows/prism-review.yml`, pinned to the commit of the current release as the `unpinned-action` rule recommends, and a `.prism-review.yml` with the main options. It leaves existing files unchanged unless given `--force`, and `--ref v0` uses a tag instead of the pinned commit.
- `prism-review --version` prints the version.
- The CLI is ready for npm as `@gabrielolvv/prism-review`, so `npx @gabrielolvv/prism-review init` and `analyze` work without a clone. The package holds only the bundled CLI, which supports Node.js 22 and later. The Release workflow can publish each version with npm trusted publishing and provenance, once `docs/releasing.md`'s setup is done.

### Changed

- The workflows in the README and `examples/basic` grant `pull-requests: write` to the review job instead of the whole workflow, so Prism Review's own `workflow-risk` rule no longer warns about them.
- The bundles target Node.js 22, and the CLI bundle starts with `#!/usr/bin/env node` so npm can run it.

### Fixed

- The dependency changes table and the dependency rules read `package.json` entries only inside `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `resolutions`, as far as the diff shows the enclosing object. `repository.url`, `homepage`, `bugs`, `engines`, and settings such as `bundlesize[].threshold` were listed as dependencies. Prism Review's own review of this release found it.

## 0.43.1 - 2026-10-29

### Added

- The README shows the comment Prism Review posts, made from the new `fixtures/diffs/showcase.diff`, with a test that keeps the two in sync, and compares Prism Review with CodeQL, Semgrep, and Danger.
- `CONTRIBUTING.md` describes how to report a false positive, set up the project, add a rule, and check it against real code.
- Issue forms for false positives and missed findings, and for new rules, with a link to private vulnerability reporting. They replace two templates for work that has shipped.

## 0.43.0 - 2026-10-29

### Fixed

False positives found by running every rule over about 16,000 files from 39 popular npm, PyPI, and RubyGems packages, such as Django, Express, Rails, requests, and Ansible:

- `weak-crypto` skips minified bundles (`*.min.js`) and lines over 500 characters, where a random call and a word such as `token` meet by chance.
- `untrusted-input` reads `params[...]` as request input in Ruby files only, so an Ansible module's `module.params[...]` is not reported, and no longer reads a Python variable named `redirect_to` as Rails' `redirect_to`.
- `file-permissions` no longer reports `old = os.umask(0)`, which reads the current umask to restore it.
- `insecure-web-config` treats Django settings under `examples/`, `samples/`, and `demos/` as development settings.
- `hidden-unicode` only checks translation catalogs (`.po`, `.xliff`, `.strings`, and similar) for tag characters, since right-to-left and Khmer translations use direction marks and zero width spaces on purpose.
- `destructive-migration` counts Django's `RemoveField`, `DeleteModel`, `RenameField`, and `RenameModel` only as calls, not in imports, `isinstance` checks, or docstrings.
- `sql-injection` counts an ActiveRecord fragment only when the interpolated string is the first argument, so the log name in `select_all(sql, "#{name} Load")` is not reported.
- `disabled-security-check` skips import lines, such as `from ssl import CERT_NONE`.
- `package.json`'s `publishConfig.tag` and `publishConfig.registry` are no longer read as dependencies.
- `lookalike-dependency` knows the npm packages `cookies` and `mquery`, which were reported as lookalikes of `cookie` and `query`.

### Added

- `scripts/scan-corpus.mjs` runs every rule over a directory of real code and counts the files each rule reports, to find false positives before a release.
- `docs/configuration.md` opens with an index of every rule by area. The table of areas, which missed several rules, is now complete, and a test keeps both in sync with the rules.

## 0.42.0 - 2026-10-29

### Added

- `untrusted-input` rule. It warns about request values passed straight to a redirect (open redirect), an outgoing request (server-side request forgery), or a file path (path traversal), on the same line, in Express, Koa, Flask, Django, PHP, Go, Rails, and ASP.NET Core. Targets that start with a fixed path or host, and lines that reduce or check the value, are not reported. `rules.untrustedInput.enabled` turns it off.

## 0.41.0 - 2026-10-29

### Added

- `weak-crypto` rule. It warns about secrets hashed with MD5 or SHA-1, DES, 3DES, RC4, RC2, and Blowfish ciphers, ECB mode, including Java's `Cipher.getInstance("AES")`, and tokens, passwords, salts, or one-time codes made with `Math.random()`, Python's `random`, or PHP's `rand()`. Hashes and random numbers are only reported on lines that name a secret, so checksums and jitter are not. `rules.weakCrypto.enabled` turns it off.

## 0.40.0 - 2026-10-29

### Added

- `insecure-web-config` rule. It reports CORS that allows every origin, or reflects the request's origin, together with credentials, in Express, raw headers, Django, Flask-CORS, Spring, and ASP.NET Core, as a high-risk finding, and warns about cookies with HttpOnly or Secure turned off and about debug modes in production: Flask `app.run(debug=True)`, Django `DEBUG = True` outside development settings, and Rails `consider_all_requests_local` in production. `rules.insecureWebConfig.enabled` turns it off.

## 0.39.1 - 2026-10-29

### Documentation

- The README describes what the review covers today, including the optional AI summary, shows CI, release, and license badges, and pins its example to a current release.
- `SECURITY.md` says how to report a vulnerability privately and what counts as one, for the Marketplace listing and the repository's Security tab.
- `docs/releasing.md` lists what to set up before the first Marketplace listing, such as the repository description, topics, and private vulnerability reporting, and how to publish each release there.

## 0.39.0 - 2026-10-29

### Added

- `file-permissions` rule. It warns about `chmod` modes and calls that make files writable by every user, such as `777`, `o+w`, `COPY --chmod=777`, or `os.chmod(path, 0o666)`, about the setuid bit, and about a `umask` that leaves new files writable by every user. `chmod 1777` for shared temporary directories and setgid directories are not reported. `rules.filePermissions.enabled` turns it off.

## 0.38.0 - 2026-10-29

### Added

- `kubernetes-rbac` rule. It reports RBAC that binds `cluster-admin`, grants a role to `system:anonymous`, `system:unauthenticated`, or `system:authenticated`, or allows every verb on every resource, as high-risk findings, and warns about other wildcard verbs or resources and the `escalate`, `bind`, and `impersonate` verbs. `rules.kubernetesRbac.enabled` turns it off.

## 0.37.0 - 2026-10-29

### Changed

- `sensitive-files` reports files that only a built-in word in their path marks sensitive, such as `src/billing/charge.ts` or `src/rules/workflow-risk.ts`, as warnings instead of high-risk findings, and no longer reports documentation, test files, or fixtures for a word. Files matching `rules.sensitiveFiles.patterns`, which include workflows, `**/auth/**`, `**/permissions/**`, and `**/migrations/**` by default, are still high. With `check.failOn: high`, a pull request that only touches such word matches no longer fails; add a glob, such as `**/billing/**`, to keep an area high.

## 0.36.0 - 2026-10-29

### Added

- `workflow-risk` warns about write scopes under a workflow's top-level `permissions:`, such as `contents: write` or `id-token: write`, which every job gets, and about new workflows that set no permissions and so get the repository's default token permissions. Job-level writes, read scopes, and reusable workflows are not reported.

## 0.35.0 - 2026-10-29

### Added

- `insecure-infrastructure` rule. It reports IAM policies that allow every action, as a high-risk finding, and warns when Terraform or CloudFormation turns off encryption, allows TLS 1.0 or 1.1, turns off CloudTrail logging or log file validation, or allows IMDSv1 with `http_tokens = "optional"`. A statement that denies every action is not reported. `rules.insecureInfrastructure.enabled` turns it off.

## 0.34.0 - 2026-10-29

### Added

- `dockerfile-risk` rule. It warns about Dockerfile base images without a version tag or with `latest`, remote `ADD` downloads without `--checksum`, secrets passed through `ENV` or `ARG`, which the image and its history keep, and a final `USER root`. It reads `Dockerfile`, `Containerfile`, `Dockerfile.*`, and `*.dockerfile`, joins continued lines, and can be turned off with `rules.dockerfileRisk.enabled`.

## 0.33.0 - 2026-10-29

### Security

- zod is upgraded from 3.25 to 4.6.7, which fixes GHSA-mrhx-c7xc-m3w5, unbounded memory use when validating oversized constrained collections. The configuration comes from the base commit, so a pull request could not reach it, but the bundled action carried the vulnerable version. Every configuration parses to the same values as before.

### Changed

- Invalid configuration messages use zod 4's wording, such as `risk.largeDiff.maxFiles: Too small: expected number to be >0`. The file and the field are named as before.

## 0.32.0 - 2026-10-27

### Fixed

- Scoped npm packages, such as `@types/node` and `@babel/core`, are read from `package.json`. They were skipped, so they were missing from the Dependency Changes table, and `risky-dependency-version` and `stale-lockfile` did not see their changes. `lookalike-dependency` still compares only unscoped names.

## 0.31.0 - 2026-10-27

### Added

- An optional AI Summary section, off by default. With `ai.enabled: true` and the new `ai-api-key` input, the review sends the redacted diff of the reviewed files and the findings to a language model, `claude-opus-5-5` by default, and shows a short overview and up to five concerns for the reviewer. The reply must match a JSON schema, concerns about files the model was not shown are dropped, and the text is escaped with mentions, references, and URLs in code spans. The summary cannot change the risk level, the findings, or the check, and a missing key or failed request leaves it out with a log line. `ai.maxInputCharacters` and `ai.timeoutSeconds` bound the request.

## 0.30.0 - 2026-10-27

### Added

- Maven and Gradle in the dependency checks: the Dependency Changes table, `lookalike-dependency`, `risky-dependency-version`, and `stale-lockfile` read `<dependency>` blocks in `pom.xml` across lines, `"group:artifact:version"` strings and `group:`/`name:`/`version:` maps in `build.gradle` and `build.gradle.kts`, and `[libraries]` in `libs.versions.toml`. Dependencies are named `group:artifact`. `+`, `latest.release`, `LATEST`, `RELEASE`, and ranges such as `[1.0,)` are open versions, a version left to a BOM or parent POM shows as `managed` and is not reported, `gradle.lockfile` is the lockfile for a build script in its own directory, and the bundled list of popular packages has the most used Maven artifacts.

## 0.29.0 - 2026-10-27

### Added

- Composer and NuGet in the dependency checks: the Dependency Changes table, `lookalike-dependency`, `risky-dependency-version`, and `stale-lockfile` read `vendor/name` entries in `composer.json`, `<PackageReference>`, `<PackageVersion>`, and `<GlobalPackageReference>` in `*.csproj`, `*.fsproj`, `*.vbproj`, and `Directory.*.props`, and `<package>` in `packages.config`. `composer.lock` and the project's own `packages.lock.json` are the lockfiles, and the bundled list of popular packages has the most used Packagist and NuGet packages.

## 0.28.0 - 2026-10-27

### Added

- Go modules in the dependency checks: the Dependency Changes table, `lookalike-dependency`, `risky-dependency-version`, and `stale-lockfile` read `require` lines and `require ( ... )` blocks in `go.mod`, including hunks that start inside a block, and skip `replace` and `exclude` blocks. `go.sum` is the lockfile. Module paths are compared without their major version suffix, such as `/v5` or gopkg.in's `.v3`, and the bundled list of popular packages has the most used Go modules.

## 0.27.0 - 2026-10-27

### Added

- `stale-lockfile` rule, a warning for a manifest whose dependencies change while its lockfile, such as `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `Pipfile.lock`, `Gemfile.lock`, or `Cargo.lock`, is not part of the pull request. It only reports manifests whose repository has the lockfile on the base commit, in the manifest's directory or above, so repositories without lockfiles and workspaces with a root lockfile are handled. The action lists at most 20 directories through the contents API, only when dependencies change; the CLI looks in the working tree.

### Changed

- `docs/sample-review-comment.md` shows a `stale-lockfile` finding, since the fixture adds a dependency without updating `package-lock.json`.

## 0.26.0 - 2026-10-27

### Added

- `risky-dependency-version` rule, a warning for dependencies moved to an older version, such as `lodash` from `4.17.21` to `4.17.20` or `requests` from `>=2.31` to `>=2.0`, and for versions changed to accept any future release: no version, `*`, `latest`, or only lower bounds. Caret, tilde, and `~>` ranges are bounded and not reported, only the version parts both sides give are compared, URLs and Git sources are not compared, and pip-compile `.in` files are skipped for open versions. New npm and Cargo dependencies added as `*` or `latest` are reported too.
- Each dependency change in the JSON output has the `line` of its new version.

## 0.25.0 - 2026-10-27

### Added

- The comment lists the dependencies the pull request adds, removes, or moves to another version in a Dependency Changes table, read from `package.json`, `requirements*.txt`, `pyproject.toml`, `Pipfile`, `Gemfile`, `*.gemspec`, and `Cargo.toml`. Reordered lines are not changes, the table shows at most 30 rows within a size budget of its own, and `comment.dependencyChanges: false` leaves it out. The JSON output lists every change under `dependencyChanges`.

### Changed

- `lookalike-dependency` reads manifests through the same parser as the table.

## 0.24.0 - 2026-10-27

### Added

- `lookalike-dependency` rule, a warning for added dependencies one character away from a widely used package in the same registry, such as `expresss`, `lodahs`, or `reqeusts`: one character added, removed, or replaced, or two neighbors swapped. It reads `package.json`, `requirements*.txt`, `pyproject.toml`, `Pipfile`, `Gemfile`, `*.gemspec`, and `Cargo.toml`, and compares with a list bundled with Prism Review, so it makes no network call. PyPI names are compared as PyPI does. Short names, scoped npm packages, and the popular names themselves are not reported, and `rules.lookalikeDependencies.allowed` lists names known to be intended.

## 0.23.0 - 2026-10-27

### Added

- `review-control-change` rule, a warning for changes to `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS`, and for added or removed `.gitattributes` lines that set `linguist-generated` or `linguist-vendored`. Both files are read from the base branch, so these changes decide how later pull requests are reviewed. Like `config-change`, the rule reads files matched by `ignorePaths` and cannot be suppressed inline. Other `.gitattributes` changes, such as `eol`, are not reported, and a patch too large to read is reported anyway.

## 0.22.0 - 2026-10-27

### Added

- `ignoreGenerated`, on by default, leaves files that `.gitattributes` marks `linguist-generated` or `linguist-vendored` out of the noise rules, like `ignorePaths`. The action reads `.gitattributes` from the base commit and the CLI from the current directory. Patterns follow gitattributes, so a directory pattern needs `/**`, and the last matching line wins, so `-linguist-vendored` brings files back. The rules that `ignorePaths` cannot hide still read these files, and the summary counts them apart.
- A `.gitattributes` that cannot be read logs a warning, and the review goes on with every file.

## 0.21.0 - 2026-10-27

### Added

- Each finding that points to a file names the file's owners from CODEOWNERS on an `Owners:` line, and the checklist asks whether the owners of the flagged files reviewed the change. The action reads `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS` from the base commit, as GitHub does; the CLI reads them from the current directory. Owners are shown in code spans, so nobody is notified. `comment.codeOwners: false` turns this off.
- A CODEOWNERS file that cannot be read logs a warning, and the review goes on without owners.

## 0.20.0 - 2026-10-27

### Added

- Each finding in the comment and each review comment on a line ends with a `Rule:` line: the rule's id, which is what an inline suppression names, linked to the rule's section in `docs/configuration.md`. The SARIF report links each rule to its section instead of the top of the document.
- `docs/configuration.md` has sections for `large-diff` and `missing-tests`, so every rule has one. A test checks that each rule's link points at a heading that exists.

## 0.19.1 - 2026-10-27

### Added

- `action.yml` has `branding`, a `shield` icon on `purple`, which GitHub Marketplace requires to list the action.
- A Release workflow creates the GitHub release for each pushed version tag, with the tag's section of this changelog as its notes, after checking that the tag matches `package.json`. It can also be run by hand for tags pushed before it existed. `scripts/release-notes.mjs` prints the notes for any version.
- `docs/releasing.md` describes how to prepare, tag, and publish a release, including the GitHub Marketplace listing.

## 0.19.0 - 2026-10-27

### Added

- The Suggested Review Checklist asks one question for each rule that reported a finding the comment shows, most severe first and at most 8, such as whether an added credential was revoked or whether a migration can be rolled back while the previous release is still running. A review without such findings keeps the four general questions.
- `comment.checklist` adds up to 10 questions of the repository's own to every review's checklist.

### Changed

- The checklist counts toward the comment's size limit, so long custom questions leave less room for findings instead of pushing the comment over GitHub's limit.

## 0.18.0 - 2026-10-27

### Added

- The review comment marks each finding that is new since the previous review with `(new)`, and opens the findings with a line that counts new findings and the ones no longer reported, by rule. The comment ends with a hidden record of its findings, as rule ids and hashes of each finding's file and title, which the next run reads from the newest review comment's last line. The same finding on another line is not new. A first review, a dry run, a comment from an older version, or a record of more than 400 findings marks nothing.

### Changed

- The action reads the existing review comment before rendering the review, so in `append` mode it also lists comments once per run.

## 0.17.0 - 2026-10-27

### Added

- The review comment groups findings by area (Secrets, Supply Chain, Infrastructure, Code, Tests, and Review Scope) when they come from more than one, with a line that counts them per area. The most severe area comes first. When the comment reaches its size limit, the counts still include every finding and each area heading says how many are shown.
- Each finding in the JSON output has an `area` field, and each rule in the SARIF report carries its area as a tag.

### Changed

- `docs/sample-review-comment.md` shows the grouped layout.

## 0.16.0 - 2026-10-27

### Added

- `reviewComments` posts each line finding as a pull request review comment on its line, opt-in with `reviewComments.enabled`. Comments are updated in place on later runs and edited to say a finding is no longer reported instead of being deleted. Lines GitHub does not accept are skipped with a warning, and `maxComments`, 25 by default, caps how many one run posts.
- Prompt-injection fixtures and tests for instructions in base64, Markdown and HTML comments, a file name, a suppression reason that claims approval, and Unicode tag characters. None of them changes the review, and none of the injected text reaches the comment, the JSON, or the SARIF report, except a file name inside a code span.

### Changed

- `docs/roadmap.md` lists everything shipped through 0.15.0.

## 0.15.0 - 2026-10-27

### Added

- `overrides` sets rule severity for findings in matching files only, such as `risky-api: off` under `legacy/**`. The top-level `severity` applies first, then each matching entry in order. Findings without a file are not affected, and unknown rule ids fail configuration loading.

## 0.14.1 - 2026-10-27

### Fixed

- Several rule patterns took time quadratic in a line's length on crafted input, so one long line, such as `curl curl curl ...`, `{{{{...`, or `${{ ${{ ...`, could take seconds and stall a review. Every repeatable span is now bounded, and a test runs each case on a 200,000-character line under three seconds. The affected rules are `lockfile-source`, `remote-script`, `disabled-security-check`, `privileged-container`, `destructive-migration`, `sql-injection`, `workflow-risk`, `blanket-suppression`, `risky-api`, `skipped-tests`, `public-exposure`, and the inline suppression marker.

## 0.14.0 - 2026-10-27

### Added

- The CLI takes `--format json` and `--format sarif`. JSON lists the risk level, counts, findings with every line they cover, and suppressed findings with their reasons. SARIF 2.1.0 places each finding on its file and line for GitHub code scanning, with inline suppressions as in-source suppressions. `check.failOn` sets the exit status in every format.
- The `sarif-file` action input also writes the review as SARIF, for `github/codeql-action/upload-sarif`. The README shows a workflow that uploads it.

## 0.13.0 - 2026-10-27

### Added

- Inline suppressions: a `prism-review-ignore rule-id -- reason` comment after the code, or alone on the line above, acknowledges a finding on that line. Suppressed findings leave the risk level and `check.failOn` and are listed with their reasons under "Suppressed Inline" in the review. A reason is required, every line of a finding must be covered, and the rules `ignorePaths` cannot hide, such as `secret-in-diff` and `credential-file`, cannot be suppressed.

## 0.12.0 - 2026-10-27

### Added

- `sql-injection` rule warns about SQL built by inserting values into the query text, in Python, JavaScript, TypeScript, Go, Java, PHP, C#, and Ruby, including SQL built into a variable first. Parameterized queries, Prisma's tagged templates, and text that only mentions SQL words are not reported. `rules.sqlInjection.enabled` turns it off.
- `disabled-security-check` rule reports, as high, code that turns off TLS certificate verification or token signature and expiry checks, in JavaScript, Python, Go, Java, C#, PHP, Ruby, shell, and Kubernetes configuration, and warns when CSRF protection is turned off in Spring, Django, Flask, or Rails. Documentation and tests are skipped. `rules.disabledSecurityChecks.enabled` turns it off.

## 0.11.0 - 2026-10-27

### Added

- `public-exposure` rule reports, as high, Terraform, CloudFormation, and Kubernetes changes that open SSH, RDP, database, cache, search, or container API ports, or every port, to `0.0.0.0/0` or `::/0`, and that make storage buckets or databases public or grant `allUsers` access. Public web ports, private ranges, outbound rules, and deny rules are not reported. `rules.publicExposure.enabled` turns it off.
- `privileged-container` rule reports, as high, privileged containers, Docker socket mounts, and added `SYS_ADMIN` or `ALL` capabilities in Kubernetes manifests, Helm values, Compose files, and `docker run` commands, and warns about host namespaces, `allowPrivilegeEscalation: true`, and running as root. Dropped capabilities and client settings such as `DOCKER_HOST` are not reported. `rules.privilegedContainers.enabled` turns it off.

## 0.10.0 - 2026-10-27

### Added

- `unpinned-action` rule warns about third-party actions, reusable workflows, and `docker://` images added to workflows by a tag or branch instead of a full commit SHA or digest. `rules.unpinnedActions.allowedOwners` lists owners whose tags are trusted, GitHub's `actions` and `github` by default. Workflows that use Prism Review as `@v0` are reported too; the README shows how to pin it.
- `remote-script` rule warns about commands that download a script and run it unchecked, such as `curl ... | sh`, `bash <(curl ...)`, `eval "$(curl ...)"`, and PowerShell's `iex (iwr ...)`, in Dockerfiles, workflows, Makefiles, and scripts. It is high when the download uses plain HTTP. Commands continued across lines with `\` are read as one. Documentation and tests are skipped. `rules.remoteScripts.enabled` turns it off.

### Changed

- `lockfile-source` also reads package sources in `pyproject.toml`: `name @ URL` dependencies, index URLs, Poetry, uv, and PDM source tables, and inline `git` and `url` sources.

## 0.9.0 - 2026-10-27

### Added

- `lockfile-source` rule reports, as high, lockfile entries and registry settings that download packages from a host outside the allowed registries or over plain HTTP, and warns about Git dependencies and pip `--extra-index-url`. It also reports pip `--trusted-host` as high and a go.mod `replace` that swaps in a different module as a warning. It reads npm, yarn, pnpm, pip, Poetry, Pipfile, uv, Cargo, Bundler, and Go files and `.npmrc`, `.yarnrc.yml`, and `pip.conf`, before the size limit, and `rules.lockfileSources.allowedSources` adds private registries.
- `credential-file` rule reports, as high, committed private keys, key stores, Terraform state, and credential files such as `.git-credentials`, `.aws/credentials`, and `kubeconfig`, and secrets added to `.env`, `.npmrc`, `.yarnrc.yml`, and `.pypirc` files. Environment files are only reported for variables whose name ends with a secret word or URLs with a password, so public, placeholder, and local development values pass. `rules.credentialFiles.enabled` turns it off.

### Fixed

- `dependency-risk` only reported manifests at the repository root, because its default globs such as `package.json` have no `/`. Globs without a `/` in `rules.dependencyRisk.manifests` and `rules.sensitiveFiles.patterns` now match the file name in any directory, as in `.gitignore`, so `packages/ui/package.json` and `services/api/requirements.txt` are reported.

## 0.8.0 - 2026-10-27

### Added

- `workflow-risk` rule reports script injection, as high, when an untrusted context such as an issue title, pull request body, branch name, or commit message is used inside `${{ }}` in a workflow `run` or `script`. It also warns about added `pull_request_target` triggers, checkouts of pull request code, and `permissions: write-all`. Only `run` and `script` values, including multi-line blocks, count as scripts; `env:`, `with:`, `name:`, and `if:` values are data and are not reported. Index syntax and whole objects passed to `toJSON` are recognized, and `ignorePaths` does not hide workflow files. `rules.workflowRisk.enabled` turns it off.
- `destructive-migration` rule reports database migrations that drop a table or column or remove every row, as high, and that rename or redefine a column, as a warning. It reads SQL and the schema calls of Rails, Django, Alembic, Knex, Sequelize, TypeORM, Laravel, Entity Framework Core, and Ecto, and skips rollback sections and files. `rules.destructiveMigration.enabled` turns it off.
- `incomplete-review` rule reports a high-risk finding when GitHub returns its limit of 3000 files and the pull request changes more, so the files that were not reviewed cannot pass a `check.failOn` gate unnoticed.

## 0.7.0 - 2026-10-20

### Added

- `severity` sets a rule's severity, such as `missing-tests: info` or `dependency-risk: high`, or turns it off. It affects the comment, the risk level, annotations, outputs, and `check.failOn`; `large-diff: off` also turns off the size check behind the risk level, and an unknown rule id fails configuration loading.
- The action writes the review to the job summary and sets the `risk-level`, `high-count`, `warning-count`, and `finding-count` step outputs.
- For a `pull_request` run from a fork, where the token is read-only, a 403 on the comment is a warning instead of a failed run, and the review stays in the job summary. A 403 on the repository's own pull requests, on `pull_request_target`, or from a rate limit still fails.
- The comment and job summary stop listing findings before GitHub's comment size limit and say how many were left out, so a pull request with thousands of findings still gets its review.
- `ignorePaths` leaves generated, vendored, or snapshot files out of the noise rules and the size check, and the summary says how many files were ignored. Globs match dotfiles, and a file renamed into an ignored path is still reviewed unless its old path is ignored too. `secret-in-diff`, `hidden-unicode`, and `config-change` still read every file. This repository ignores its `dist/` bundles.

### Changed

- A `pull_request` run for a pull request from a fork used to fail when the read-only token could not post the comment. It now passes with a warning, and `check.failOn` still decides whether the findings fail the job. Every run also writes the review to the job summary.

## 0.6.0 - 2026-10-20

### Added

- `hidden-unicode` rule reports added lines and file names that contain bidirectional controls, as high, or invisible characters such as zero width spaces, invisible operators, Hangul fillers, and Unicode tag characters, as a warning. Patches over `security.maxPatchBytes` are still scanned. These can make code read differently from how it runs (Trojan Source, CVE-2021-42574) or hide instructions from a reviewer. The comment shows hidden characters in file names as `\u{...}` escapes. `rules.hiddenUnicode.enabled` turns it off.
- `fixtures/diffs/prompt-injection.diff` and a test that instructions aimed at an AI reviewer, including a forged review header, do not change the review or reach the comment.
- The CLI reviews a diff from standard input with `analyze --diff -`, so `git diff origin/main...HEAD | prism-review analyze --diff -` works as a pre-push check together with `check.failOn`. `--diff` also takes a file path, and `--fixture` remains as an alias. `--help` prints usage. Input that cannot be reviewed, such as an empty diff, colored output, or text with no `diff --git` section, is an error rather than an empty review that passes, and git's quoted file names and `diff.mnemonicPrefix` and `diff.noprefix` output are parsed.
- `risky-api`, `blanket-suppression`, and `skipped-tests` cover Ruby, Java, Kotlin, and PHP: `eval`, shell commands, `Marshal.load`, `.html_safe`, `Runtime.exec`, Java deserialization, `unserialize`, and PHP shell functions; `rubocop:disable all`, `@SuppressWarnings("all")`, `CHECKSTYLE:OFF`, `NOSONAR`, `@phpstan-ignore-line`, and bare `phpcs:ignore`; RSpec focus and skip blocks, Minitest `skip`, JUnit `@Disabled` and `@Ignore`, TestNG `enabled = false`, PHPUnit `markTestSkipped`, and Pest `->only()` and `->skip()`.
- The same rules cover C# and Swift: `Process.Start` with a shell, `BinaryFormatter` and other unsafe .NET deserializers, `Html.Raw`, a Swift `Process` that runs `/bin/sh`, `NSKeyedUnarchiver.unarchiveObject`, and `evaluateJavaScript` with interpolation; `#pragma warning disable` with no codes, `ReSharper disable All`, and `swiftlint:disable all`; xUnit `Skip =`, NUnit and MSTest `[Ignore]`, `XCTSkip`, and Swift Testing `.disabled`.

### Changed

- `hidden-unicode` is on by default, and the line-level rules now also read Ruby, Java, Kotlin, PHP, C#, and Swift, so workflows that use `@v0` can report new findings as soon as they pick up this release. With `check.failOn: high`, a bidirectional control character fails the job. Each rule can be turned off in `.prism-review.yml`.
- The CLI fails with a clear error when `--config` names a file that does not exist, instead of silently using the defaults, and rejects unknown options instead of ignoring them.
- `rules.missingTests.testGlobs` also matches `*_spec.rb`, `*_test.rb`, `src/test/**`, `*Test.php`, `*Tests.cs`, `*Test.cs`, `*.Tests/**`, and `*Tests.swift` by default, so changes to those files count as test changes.
- `skipped-tests` only applies each framework's markers to files of its own language, so a Go `.Skip(` call in a JavaScript test is no longer reported.

## 0.5.0 - 2026-10-20

### Added

- `risky-api` rule warns, with the line number, when a pull request adds a call that runs a string as code, starts a shell, deserializes untrusted data, or writes raw HTML in JavaScript, TypeScript, Python, or Go source. Member calls and definitions with the same name, such as `pattern.exec(input)`, `model.eval()`, and `def eval(self):`, are not reported, and test files are skipped. `rules.riskyApis.enabled` turns it off.
- `check.failOn` fails the job when the review has a finding at or above `high` or `warning`, after the comment and annotations are published, so branch protection can require Prism Review to pass. The default, `never`, keeps the current behavior. The CLI exits with status 1 under the same condition.
- `blanket-suppression` rule warns, with the line number, when a pull request adds a lint or type check suppression that names no rule: `eslint-disable` without rule names, `@ts-nocheck`, `@ts-ignore`, a bare `# noqa` or `# type: ignore`, `# pylint: disable=all`, `# mypy: ignore-errors`, `//nolint` without a linter, and Rust `allow(warnings)` or `allow(clippy::all)`. Each marker only counts in files of its own language, and targeted suppressions are not reported. `rules.blanketSuppression.enabled` turns it off.

### Changed

- `risky-api` and `blanket-suppression` are on by default, so workflows that use `@v0` report them as soon as they pick up this release. Each can be turned off in `.prism-review.yml`.

### Fixed

- The README listed six of the ten rules, described the patch size limit as running before all pattern matching, and still listed shipped annotations as roadmap work. A test now fails when a registered rule is missing from the README or `docs/configuration.md`.
- `sensitive-files` reported files such as `docs/rule-authoring.md`, `src/tokenizer.ts`, and `AUTHORS` as high risk because their paths contain `auth` or `token`. A short list of words that only look related (`author`, `tokenize`, `parole`, `secretary`) is now left out; every other path that contains a sensitive word, such as `Unauthorized.ts` or `jwtauth/`, is still reported.

## 0.4.0 - 2026-10-20

### Added

- `secret-in-diff` rule reports a high-risk finding, with the line number, when an added line contains a GitHub token, an OpenAI-style key, an AWS access key ID, or a private key header, including PGP key blocks. Patches over `security.maxPatchBytes` are still scanned. The value is redacted everywhere; `security.redaction.allowlist` exempts known test values, and `rules.secretInDiff.enabled` turns the rule off.
- `skipped-tests` rule warns, with the line number, when a pull request adds a focused or skipped test in a file matched by `rules.missingTests.testGlobs`. It recognizes Jest, Vitest, Mocha, Jasmine, and `node:test` markers, pytest and unittest skips including `skipif`, Go `.Skip` calls, and Rust `#[ignore]` in any `.rs` file. `rules.skippedTests.enabled` turns it off.
- The review comment shows the line number next to the file when a finding has one.
- `annotations.enabled` prints findings that name a file as workflow command annotations, so they appear beside the file in the pull request diff without the `checks: write` permission. `annotations.includeLowSeverity` adds `info` findings as notices.
- GitHub Enterprise Server support: API requests go to `GITHUB_API_URL`, which the runner sets for the instance, and fall back to `https://api.github.com` when it is unset.

### Changed

- `secret-in-diff` and `skipped-tests` are on by default, so workflows that use `@v0` report them as soon as they pick up this release. Each can be turned off in `.prism-review.yml`.
- `rules.missingTests.testGlobs` also matches `__tests__/` directories and Python, Go, and Rust test files by default. Changes to those files now count as test changes for `missing-tests`.
- Finding messages say "This file" instead of repeating the path; the path is shown on the `File:` line.

### Fixed

- The documented workflow permissions could not post the review comment. On a pull request, the token needs `pull-requests: write`; `issues: write` with `pull-requests: read` fails with `403 Resource not accessible by integration`. The README, the example workflow, and the dogfood workflow now request `contents: read` and `pull-requests: write`.
- A pull request file name containing backticks or newlines could add Markdown, such as headings, a fake risk level, or HTML comments, to the review comment. Paths are now shown in code spans with newlines spelled out, which also keeps @mentions and issue references in file names from notifying anyone, and finding text is escaped.
- With `dry-run: true`, a pull request file name containing a newline could issue workflow commands, such as forged annotations or `::add-mask::`, through the printed review.

## 0.3.0 - 2026-07-24

### Added

- The action loads its configuration from the pull request base commit through the contents API, so a pull request cannot relax the rules that review it.
- `config-change` rule flags any change to the configuration file, including adding, deleting, or renaming it, as high risk.
- `comment.mode: append` posts a new comment on every run.
- `npm run test:action` runs the bundled action end to end against a fake GitHub API, and CI runs it after rebuilding the bundle.
- MIT `LICENSE` file.

### Changed

- Workflows no longer need `actions/checkout`; the action reads everything through the GitHub API.
- `config-path` must be a relative path inside the repository.
- Configuration errors name the file, the base commit, and the rejected field.
- `upsert` updates the most recent comment that a bot posted starting with the marker.
- `analyzePullRequest` takes an options object with `rules` and `configPath`.
- Renamed files carry `previousPath`.
- GitHub API failures raise `GitHubApiError`, which keeps the HTTP status.
- CI runs on Node 24, the same runtime the action declares.

### Fixed

- Action inputs were read from `INPUT_GITHUB_TOKEN` instead of `INPUT_GITHUB-TOKEN`, so the action failed on every pull request with a missing `github-token` error.
- `upsert` could overwrite any comment that contained the marker, including a person's reply that quoted the review.
- `comment.mode: append` was accepted by the schema but behaved like `upsert`.
- `docs/sample-review-comment.md` listed findings in a different order than the real output.

## 0.2.0 - 2026-07-21

### Added

- `security.maxPatchBytes` drops oversized patches before redaction and analysis.
- `oversized-patch` rule reports files whose patch was not inspected.
- `security.redaction.allowlist` keeps known false positives readable.
- Mocked `fetch` tests for the GitHub client, pull request file mapping, and comment upserts.
- CI check that fails when the committed bundle is stale.

### Changed

- The action and CLI ship as self-contained bundles in `dist/`, built with esbuild.
- Type checking and tests compile into `build/` instead of `dist/`.
- The action runs on the `node24` runtime.
- GitHub API requests time out after 15 seconds, pagination stops after 30 pages, and error details are truncated.

### Fixed

- `action.yml` pointed at an entrypoint that was never generated.
- The action failed at runtime because its dependencies were not available on the runner.
- `comment.includeLowSeverity` was ignored by the Markdown renderer.
- CI did not run on pushes to `master`.
- `brace-expansion` updated to a release without the unbounded expansion advisories.

## 0.1.0 - 2026-07-15

### Added

- Deterministic pull request analysis engine with `large-diff`, `missing-tests`, `sensitive-files`, and `dependency-risk` rules.
- GitHub Action integration with a single upserted pull request comment.
- Secret redaction for patch content.
- Fixture-based CLI analysis and unit tests.
