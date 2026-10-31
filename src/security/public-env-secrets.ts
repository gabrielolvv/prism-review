import { patchLines } from "../analysis/added-lines.js";

// Build tools copy variables with these prefixes into the JavaScript they send to browsers: Next.js,
// Vite, Create React App, Expo, Nuxt, Gatsby, Vue CLI, and SvelteKit.
const publicPrefix = String.raw`(?:NEXT_PUBLIC|VITE|REACT_APP|EXPO_PUBLIC|NUXT_PUBLIC|NUXT_ENV|GATSBY|VUE_APP|PUBLIC)_`;

// Names that end like a secret only a server should hold. API keys and tokens are left out, since
// browser SDKs such as Firebase, Mapbox, and Stripe's publishable keys are meant to be public.
const secretEnding =
  /(?:SECRET(?:_KEY|_ACCESS_KEY)?|PRIVATE_KEY|PASSW(?:OR)?D|DB_PASS|SERVICE_ROLE(?:_KEY)?|SERVICE_ACCOUNT(?:_KEY|_JSON)?|ADMIN_(?:KEY|TOKEN)|DATABASE_URL|DB_URL|(?:SIGNING|ENCRYPTION|MASTER)_KEY)$/;

const publicName = new RegExp(String.raw`(?<![\w$])${publicPrefix}[A-Z0-9_]+\b`, "g");

// Next.js `env`, Vite `define`, and webpack's DefinePlugin and EnvironmentPlugin copy the variables
// they name into the client bundle too.
const nextConfig = /(?:^|\/)next\.config\.[cm]?[jt]s$/i;
const bundlerConfig = /(?:^|\/)(?:vite|webpack|next|vue|nuxt|rollup)\.config\.[cm]?[jt]s$|(?:^|\/)config\/webpack[^/]*\.[cm]?[jt]s$/i;
// `env` exposes variables only in next.config; elsewhere, as in Vitest's `test.env`, it sets them
// for the tool itself.
const nextEnvBlock = /\benv\s*:\s*\{/;
const exposingBlock = /\bdefine\s*:\s*\{|\bnew\s+(?:\w+\.)?DefinePlugin\s*\(\s*\{|\bnew\s+(?:\w+\.)?EnvironmentPlugin\s*\(\s*[[{]/;
// Any variable named in the block, as a key or in a value, ends up in the bundle.
const upperName = /\b[A-Z][A-Z0-9_]*\b/g;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|<!--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const maxLineLength = 1_000;

// Added lines that name a secret in a variable the build sends to browsers.
export function findPublicSecretLines(path: string, patch: string): number[] {
  if (documentation.test(path) || skippedFile.test(path)) {
    return [];
  }

  const next = nextConfig.test(path);
  const readsConfig = bundlerConfig.test(path) || next;
  const found = new Set<number>();
  // The brace depth inside an `env`, `define`, or plugin block, or -1 outside one.
  let depth = -1;
  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      depth = -1;
    }
    if (content.length > maxLineLength) {
      continue;
    }

    let inBlock = depth > 0;
    if (readsConfig) {
      if (depth < 0 && (exposingBlock.test(content) || (next && nextEnvBlock.test(content)))) {
        depth = 0;
        inBlock = true;
      }
      if (depth >= 0) {
        depth += (content.match(/[{[(]/g) ?? []).length - (content.match(/[}\])]/g) ?? []).length;
        if (depth <= 0) {
          depth = -1;
        }
      }
    }
    if (!added || commentLine.test(content)) {
      continue;
    }

    const names = content.match(publicName) ?? [];
    if (names.some((name) => secretEnding.test(name))) {
      found.add(line);
      continue;
    }
    if (inBlock && (content.match(upperName) ?? []).some((name) => secretEnding.test(name))) {
      found.add(line);
    }
  }
  return [...found].sort((a, b) => a - b);
}
