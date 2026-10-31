import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { publicEnvSecretRule } from "../../src/rules/public-env-secret.js";
import { prepareChangedFiles } from "../../src/security/prepare-changed-files.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return publicEnvSecretRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPublicEnvSecretReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/lib/payments.ts", [
      "const stripe = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY!);",
      "const url = process.env.NEXT_PUBLIC_API_URL;",
      "const admin = createClient(url, import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Secret sent to browsers");
  assert.deepEqual(finding?.lines, [1, 3]);
  assert.equal(
    finding?.message,
    "Lines 1, 3 put secrets in an environment variable that the build copies into the JavaScript it sends to browsers, where anyone who opens the site can read them."
  );
}

export function testPublicEnvSecretReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    [".env.local", ["NEXT_PUBLIC_STRIPE_SECRET_KEY=change-me"]],
    [".env.example", ["VITE_DATABASE_URL="]],
    ["src/api.js", ["const secret = process.env.REACT_APP_CLIENT_SECRET;"]],
    ["app/config.ts", ["export const key = process.env.EXPO_PUBLIC_PRIVATE_KEY;"]],
    ["src/routes/+page.ts", ["import { PUBLIC_JWT_SECRET } from '$env/static/public';"]],
    ["nuxt.config.ts", ["  NUXT_PUBLIC_ADMIN_TOKEN: process.env.NUXT_PUBLIC_ADMIN_TOKEN,"]],
    [".github/workflows/deploy.yml", ["          VUE_APP_DB_PASSWORD: ${{ secrets.DB_PASSWORD }}"]],
    ["Dockerfile", ["ARG GATSBY_SIGNING_KEY"]],
    // Next.js `env` and Vite `define` copy the variables they name into the bundle.
    ["next.config.js", ["module.exports = {", "  env: {", "    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,", "  },", "};"]],
    ["vite.config.ts", ["export default defineConfig({", "  define: {", "    'process.env.API_SECRET': JSON.stringify(process.env.API_SECRET),", "  },", "});"]],
    ["webpack.config.js", ["  plugins: [new webpack.EnvironmentPlugin(['NODE_ENV', 'AWS_SECRET_ACCESS_KEY'])],"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicEnvSecretSkipsPublicValues(): void {
  const cases: Array<[string, string[]]> = [
    // Keys and tokens browser SDKs are meant to have.
    [".env", ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_abc", "NEXT_PUBLIC_FIREBASE_API_KEY=AIza", "NEXT_PUBLIC_MAPBOX_TOKEN=pk.abc", "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ"]],
    // Server-only names, and names that only contain a secret word.
    ["src/server.ts", ["const key = process.env.STRIPE_SECRET_KEY;", "const min = process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH;"]],
    // `env` outside next.config sets the tool's own environment, and other config blocks.
    ["vitest.config.ts", ["export default defineConfig({", "  test: {", "    env: { DATABASE_URL: 'postgres://localhost/test' },", "  },", "});"]],
    ["next.config.js", ["module.exports = {", "  env: {", "    API_URL: process.env.API_URL,", "  },", "  serverRuntimeConfig: {", "    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,", "  },", "};"]],
    ["src/api.js", ["// process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY must never be set"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPublicEnvSecretSkipsTestsAndCanBeDisabled(): void {
  const line = "const key = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;";
  assert.deepEqual(findings([added("src/pay.test.ts", [line]), added("fixtures/pay.ts", [line]), added("docs/env.md", [line])]), []);

  const config = prismConfigSchema.parse({ rules: { publicEnvSecret: { enabled: false } } });
  assert.deepEqual(findings([added("src/pay.ts", [line])], config), []);
}

export function testPublicEnvSecretSeesLinesRedactionRewrites(): void {
  // Redaction rewrites `const secret = ...` because of the name, so names are found before it.
  const files = prepareChangedFiles([added("src/pay.ts", ["const secret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;"])], defaultConfig);

  assert.doesNotMatch(files[0]?.patch ?? "", /NEXT_PUBLIC_STRIPE_SECRET_KEY/);
  assert.deepEqual(
    analyzePullRequest(files, defaultConfig).findings.filter((finding) => finding.ruleId === "public-env-secret").map((finding) => finding.line),
    [1]
  );
}
