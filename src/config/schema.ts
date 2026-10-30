import * as z from "zod";
import { ruleIds } from "../rules/ids.js";

const knownRuleIds = new Set(ruleIds);

// Per-rule severity, or "off" to drop a rule's findings. Unknown ids are an error, so a typo
// cannot silently leave a rule at its default.
const severityMap = z.record(z.string(), z.enum(["off", "info", "warning", "high"])).superRefine((overrides, context) => {
  for (const id of Object.keys(overrides)) {
    if (!knownRuleIds.has(id)) {
      context.addIssue({ code: "custom", message: `Unknown rule "${id}".` });
    }
  }
});

export const prismConfigSchema = z.object({
  risk: z
    .object({
      largeDiff: z
        .object({
          maxFiles: z.number().int().positive().default(25),
          maxChangedLines: z.number().int().positive().default(800)
        })
        .prefault({})
    })
    .prefault({}),
  rules: z
    .object({
      missingTests: z
        .object({
          enabled: z.boolean().default(true),
          sourceGlobs: z.array(z.string()).default(["src/**/*.{ts,tsx,js,jsx}"]),
          testGlobs: z
            .array(z.string())
            .default([
              "**/*.test.*",
              "**/*.spec.*",
              "**/__tests__/**",
              // Test directories, such as Mocha's test/, pytest's and Cargo's tests/, and RSpec's spec/.
              "**/test/**",
              "**/tests/**",
              "**/spec/**",
              "**/test_*.py",
              "**/*_test.py",
              "**/tests.py",
              "**/*_test.go",
              "**/*_spec.rb",
              "**/*_test.rb",
              "**/src/test/**",
              "**/*Test.php",
              "**/*Tests.cs",
              "**/*Test.cs",
              "**/*.Tests/**",
              "**/*Tests.swift"
            ])
        })
        .prefault({}),
      sensitiveFiles: z
        .object({
          enabled: z.boolean().default(true),
          patterns: z
            .array(z.string())
            .default([
              ".github/workflows/**",
              "**/auth/**",
              "**/permissions/**",
              "**/migrations/**"
            ])
        })
        .prefault({}),
      dependencyRisk: z
        .object({
          enabled: z.boolean().default(true),
          manifests: z
            .array(z.string())
            .default([
              "package.json",
              "package-lock.json",
              "pnpm-lock.yaml",
              "yarn.lock",
              "requirements.txt",
              "pyproject.toml",
              "poetry.lock",
              "go.mod",
              "go.sum",
              "Cargo.toml",
              "Cargo.lock"
            ])
        })
        .prefault({}),
      secretInDiff: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      skippedTests: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      blanketSuppression: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      riskyApis: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      remoteScripts: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      disabledSecurityChecks: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      untrustedInput: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      weakCrypto: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      xmlExternalEntities: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      massAssignment: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      redos: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      insecureWebConfig: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      sqlInjection: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      hiddenUnicode: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      workflowRisk: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      unpinnedActions: z
        .object({
          enabled: z.boolean().default(true),
          // Owners whose actions may be used by tag, compared without case. GitHub's own by default.
          allowedOwners: z.array(z.string().min(1).max(100)).default(["actions", "github"])
        })
        .prefault({}),
      destructiveMigration: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      dockerfileRisk: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      privilegedContainers: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      filePermissions: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      kubernetesRbac: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      insecureInfrastructure: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      publicExposure: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      credentialFiles: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      hardcodedJwtSecret: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      secretLogging: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      urlCredentials: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      unescapedHtml: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      timingUnsafeComparison: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      postMessageOrigin: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      nosqlInjection: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      templateInjection: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      prototypePollution: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      ldapXpathInjection: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      uploadFilename: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      reflectedXss: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      staleLockfiles: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      riskyDependencyVersions: z
        .object({
          enabled: z.boolean().default(true)
        })
        .prefault({}),
      lookalikeDependencies: z
        .object({
          enabled: z.boolean().default(true),
          // Dependency names known to be the intended packages, though they look like popular ones.
          allowed: z.array(z.string().min(1).max(214)).max(500).default([])
        })
        .prefault({}),
      lockfileSources: z
        .object({
          enabled: z.boolean().default(true),
          // URL prefixes of private registries, added to the public ones.
          allowedSources: z
            .array(z.string().max(500).refine(isRegistryUrl, "Must be an http or https URL, such as https://npm.pkg.github.com/."))
            .default([])
        })
        .prefault({})
    })
    .prefault({}),
  security: z
    .object({
      maxPatchBytes: z.number().int().positive().default(200_000),
      redaction: z
        .object({
          allowlist: z
            .array(
              z
                .string()
                .min(1)
                .max(200)
                .refine(isRegularExpression, "Must be a valid regular expression.")
            )
            .default([])
        })
        .prefault({})
    })
    .prefault({}),
  comment: z
    .object({
      mode: z.enum(["upsert", "append"]).default("upsert"),
      includeLowSeverity: z.boolean().default(false),
      // The repository's own questions, added to every review's checklist.
      checklist: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
      // Names the CODEOWNERS owners of each flagged file.
      codeOwners: z.boolean().default(true),
      // Lists the dependencies the pull request adds, removes, or moves to another version.
      dependencyChanges: z.boolean().default(true)
    })
    .prefault({}),
  ignorePaths: z.array(z.string()).default([]),
  // Leaves files marked `linguist-generated` or `linguist-vendored` in .gitattributes out like ignorePaths.
  ignoreGenerated: z.boolean().default(true),
  severity: severityMap.prefault({}),
  // Severity for findings in matching files, applied after `severity`; later entries win.
  overrides: z
    .array(
      z.object({
        paths: z.array(z.string().min(1).max(500)).min(1),
        severity: severityMap
      })
    )
    .default([]),
  check: z
    .object({
      failOn: z.enum(["never", "warning", "high"]).default("never")
    })
    .prefault({}),
  annotations: z
    .object({
      enabled: z.boolean().default(false),
      includeLowSeverity: z.boolean().default(false)
    })
    .prefault({}),
  // Line findings as pull request review comments on the changed lines.
  reviewComments: z
    .object({
      enabled: z.boolean().default(false),
      includeLowSeverity: z.boolean().default(false),
      maxComments: z.number().int().min(1).max(100).default(25)
    })
    .prefault({}),
  // An advisory summary written by a language model from the redacted diff. Off unless enabled,
  // and it needs the `ai-api-key` input, since it sends the diff to the provider's API.
  ai: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(["anthropic"]).default("anthropic"),
      model: z.string().trim().regex(/^[\w.:@/-]{1,100}$/, "Must be a model name, such as claude-opus-5-5.").default("claude-opus-5-5"),
      // The diff text sent, in characters; files past it are sent by name only.
      maxInputCharacters: z.number().int().min(1_000).max(500_000).default(100_000),
      timeoutSeconds: z.number().int().min(10).max(600).default(120)
    })
    .prefault({})
});

function isRegularExpression(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

function isRegistryUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const defaultConfigPath = ".prism-review.yml";

export type PrismConfig = z.infer<typeof prismConfigSchema>;

export const defaultConfig: PrismConfig = prismConfigSchema.parse({});
