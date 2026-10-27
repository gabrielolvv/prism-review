import assert from "node:assert/strict";
import { parseCodeOwners } from "../../src/analysis/code-owners.js";
import type { Finding } from "../../src/analysis/finding.js";
import { prismConfigSchema } from "../../src/config/schema.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

// The examples from GitHub's documentation of CODEOWNERS syntax.
export function testCodeOwnersFollowGitHubPatterns(): void {
  const owners = parseCodeOwners(
    [
      "# Default owners",
      "*       @global-owner1 @global-owner2",
      "*.js    @js-owner #This is an inline comment.",
      "*.go docs@example.com",
      "*.txt @octo-org/octocats",
      "/build/logs/ @doctocat",
      "docs/* docs@example.com",
      "apps/ @octocat",
      "/docs/ @doctocat",
      "/scripts/ @doctocat @octocat",
      "**/logs @octocat",
      "/apps/ @octocat",
      "/apps/github"
    ].join("\r\n")
  );
  const cases: Array<[string, string[]]> = [
    ["README.md", ["@global-owner1", "@global-owner2"]],
    ["src/app.js", ["@js-owner"]],
    ["cmd/main.go", ["docs@example.com"]],
    ["notes/a.txt", ["@octo-org/octocats"]],
    ["build/logs/today.log", ["@octocat"]],
    ["deeply/nested/logs/x.log", ["@octocat"]],
    ["docs/getting-started.md", ["@doctocat"]],
    ["scripts/deploy.sh", ["@doctocat", "@octocat"]],
    ["apps/web/index.ts", ["@octocat"]],
    ["lib/apps/tool.ts", ["@octocat"]],
    // The last matching pattern has no owners, so the file has none.
    ["apps/github/index.ts", []]
  ];
  for (const [path, expected] of cases) {
    assert.deepEqual(owners.ownersOf(path), expected, path);
  }

  // `docs/*` does not reach into subdirectories.
  const docs = parseCodeOwners("* @all\ndocs/* @docs");
  assert.deepEqual(docs.ownersOf("docs/a.md"), ["@docs"]);
  assert.deepEqual(docs.ownersOf("docs/build/a.md"), ["@all"]);
}

export function testCodeOwnersSkipLinesGitHubCannotRead(): void {
  const owners = parseCodeOwners(
    [
      "* @all",
      "!src/ @negated",
      "src/[ab].ts @range",
      `${"a".repeat(600)} @long`,
      "src/ @team not-an-owner @org/team-name `@x` @-bad"
    ].join("\n")
  );

  assert.deepEqual(owners.ownersOf("src/a.ts"), ["@team", "@org/team-name"]);
  assert.deepEqual(owners.ownersOf("lib/a.ts"), ["@all"]);
  assert.deepEqual(parseCodeOwners("").ownersOf("a.ts"), []);
}

export function testRenderMarkdownNamesOwnersWithoutMentioningThem(): void {
  const owners = parseCodeOwners(
    ["src/billing/ @acme/payments @alice", "src/auth/ @acme/security", "src/many/ @a1 @a2 @a3 @a4 @a5 @a6 @a7"].join("\n")
  );
  const finding = (file: string, ruleId = "sensitive-files"): Finding => ({
    ruleId,
    title: "Sensitive file changed",
    severity: "high",
    file,
    message: "Check it."
  });
  const markdown = renderMarkdown(
    {
      summary: "Reviewed 4 changed file(s).",
      riskLevel: "high",
      findings: [finding("src/billing/charge.ts"), finding("src/auth/session.ts"), finding("src/many/x.ts"), finding("README.md")]
    },
    { includeLowSeverity: false, ownersOf: owners.ownersOf }
  );

  assert.match(markdown, /^File: `src\/billing\/charge\.ts`\n\nOwners: `@acme\/payments`, `@alice`\n/m);
  assert.match(markdown, /^Owners: `@a1`, `@a2`, `@a3`, `@a4`, `@a5` and 2 more$/m);
  assert.equal(markdown.match(/^Owners: /gm)?.length, 3);
  assert.match(
    markdown,
    /^- Have the code owners of the flagged files, `@acme\/payments`, `@alice`, `@acme\/security`, `@a1`, `@a2` and 5 more, reviewed the change\?$/m
  );
  // Every @ is inside a code span, so nobody is notified.
  assert.doesNotMatch(markdown.replace(/`[^`\n]*`/g, ""), /@/);

  // Without CODEOWNERS, or with it turned off, nothing changes.
  const plain = renderMarkdown({ summary: "Reviewed 1 changed file(s).", riskLevel: "high", findings: [finding("src/auth/x.ts")] });
  assert.doesNotMatch(plain, /Owners:|code owners/);
  assert.equal(prismConfigSchema.parse({}).comment.codeOwners, true);
  assert.equal(prismConfigSchema.parse({ comment: { codeOwners: false } }).comment.codeOwners, false);
}
