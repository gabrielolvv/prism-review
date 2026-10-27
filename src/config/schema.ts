import { z } from "zod";
import { ruleIds } from "../rules/ids.js";

const knownRuleIds = new Set(ruleIds);

export const prismConfigSchema = z.object({
  risk: z
    .object({
      largeDiff: z
        .object({
          maxFiles: z.number().int().positive().default(25),
          maxChangedLines: z.number().int().positive().default(800)
        })
        .default({})
    })
    .default({}),
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
              "**/test_*.py",
              "**/*_test.py",
              "**/*_test.go",
              "**/tests/**/*.rs",
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
        .default({}),
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
        .default({}),
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
        .default({}),
      secretInDiff: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      skippedTests: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      blanketSuppression: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      riskyApis: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      remoteScripts: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      hiddenUnicode: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      workflowRisk: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      destructiveMigration: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      credentialFiles: z
        .object({
          enabled: z.boolean().default(true)
        })
        .default({}),
      lockfileSources: z
        .object({
          enabled: z.boolean().default(true),
          // URL prefixes of private registries, added to the public ones.
          allowedSources: z
            .array(z.string().max(500).refine(isRegistryUrl, "Must be an http or https URL, such as https://npm.pkg.github.com/."))
            .default([])
        })
        .default({})
    })
    .default({}),
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
        .default({})
    })
    .default({}),
  comment: z
    .object({
      mode: z.enum(["upsert", "append"]).default("upsert"),
      includeLowSeverity: z.boolean().default(false)
    })
    .default({}),
  ignorePaths: z.array(z.string()).default([]),
  // Per-rule severity, or "off" to drop a rule's findings. Unknown ids are an error, so a typo
  // cannot silently leave a rule at its default.
  severity: z
    .record(z.enum(["off", "info", "warning", "high"]))
    .default({})
    .superRefine((overrides, context) => {
      for (const id of Object.keys(overrides)) {
        if (!knownRuleIds.has(id)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown rule "${id}".` });
        }
      }
    }),
  check: z
    .object({
      failOn: z.enum(["never", "warning", "high"]).default("never")
    })
    .default({}),
  annotations: z
    .object({
      enabled: z.boolean().default(false),
      includeLowSeverity: z.boolean().default(false)
    })
    .default({})
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
