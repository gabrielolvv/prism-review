import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { ldapXpathInjectionRule } from "../../src/rules/ldap-xpath-injection.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return ldapXpathInjectionRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testLdapXpathInjectionReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/java/Auth.java", [
      'String filter = "(&(objectClass=person)(uid=" + username + "))";',
      "NamingEnumeration<SearchResult> results = ctx.search(BASE, filter, controls);",
      "String expr = \"//user[name/text()='\" + name + \"']\";",
      "Node node = (Node) xpath.evaluate(expr, doc, XPathConstants.NODE);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "LDAP or XPath query built from text");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 insert values into an LDAP filter, where a value such as `*)(uid=*` can match every user, and an XPath expression, where a value such as `' or '1'='1` can select every node."
  );
}

export function testLdapXpathInjectionReadsEachLanguage(): void {
  const cases: Array<[string, string]> = [
    ["app/auth.py", 'conn.search_s(BASE, ldap.SCOPE_SUBTREE, f"(uid={username})")'],
    ["app/auth.py", 'conn.search(search_base=BASE, search_filter="(mail=%s)" % email)'],
    ["src/Auth.php", '$result = ldap_search($ds, $base, "(uid=$username)");'],
    ["src/auth.js", "client.search(base, { filter: `(uid=${req.body.user})`, scope: 'sub' }, cb);"],
    ["Services/Auth.cs", 'var searcher = new DirectorySearcher(entry, $"(sAMAccountName={user})");'],
    ["internal/auth.go", 'req := ldap.NewSearchRequest(base, 2, 0, 0, 0, false, fmt.Sprintf("(uid=%s)", user), attrs, nil)'],
    ["app/users.py", "user = tree.xpath(f\"//user[name='{name}']\")"],
    ["src/Users.php", "$nodes = $xpath->query(\"//user[@name='\" . $name . \"']\");"],
    ["src/users.js", "const nodes = xpath.select(`//user[name='${name}']`, doc);"],
    ["app/models/user.rb", "doc.xpath(\"//user[name='#{params[:name]}']\")"],
    ["Services/Users.cs", "var node = doc.SelectSingleNode(\"//user[@name='\" + name + \"']\");"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testLdapXpathInjectionSkipsEscapedAndBoundValues(): void {
  const cases: Array<[string, string[]]> = [
    // Escaped values and filter arguments.
    ["app/auth.py", ['conn.search_s(BASE, ldap.SCOPE_SUBTREE, f"(uid={escape_filter_chars(username)})")']],
    ["src/Auth.php", ['$result = ldap_search($ds, $base, "(uid=" . ldap_escape($username, "", LDAP_ESCAPE_FILTER) . ")");']],
    ["internal/auth.go", ['req := ldap.NewSearchRequest(base, 2, 0, 0, 0, false, fmt.Sprintf("(uid=%s)", ldap.EscapeFilter(user)), attrs, nil)']],
    ["src/main/java/Auth.java", ['ctx.search(base, "(&(objectClass=person)(uid={0}))", new Object[] { username }, controls);']],
    // Bound XPath variables and fixed expressions.
    ["app/users.py", ['user = tree.xpath("//user[name=$name]", name=name)']],
    ["app/users.py", ["user = tree.xpath(\"//user[@active='true']\")"]],
    // CSS selectors, regular expressions, and text that never reaches a query.
    ["src/tabs.js", ["const panel = $tabs.find('[data-tab=' + id + ']');"]],
    ["src/main/java/Urls.java", ['private static final Pattern PATH = Pattern.compile("^https?://[^/]+");']],
    ["src/search.js", ["const label = `(uid=${user})`;", "console.log(label);"]],
    ["app/views.py", ['msg = f"Logged in as (uid={user})"']],
    // Comments.
    ["src/main/java/Auth.java", ['// ctx.search(base, "(uid=" + username + ")", controls);']]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testLdapXpathInjectionSkipsTestsAndOtherFiles(): void {
  const line = 'conn.search_s(BASE, ldap.SCOPE_SUBTREE, f"(uid={username})")';

  assert.deepEqual(findings([added("tests/test_auth.py", [line]), added("fixtures/auth.py", [line]), added("docs/auth.md", [line])]), []);
}

export function testLdapXpathInjectionCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { ldapXpathInjection: { enabled: false } } });

  assert.deepEqual(findings([added("app/auth.py", ['conn.search_s(BASE, 2, f"(uid={username})")'])], config), []);
}
