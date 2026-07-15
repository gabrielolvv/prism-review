import { z } from "zod";
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
            testGlobs: z.array(z.string()).default(["**/*.test.*", "**/*.spec.*"])
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
            .default({})
    })
        .default({}),
    comment: z
        .object({
        mode: z.enum(["upsert", "append"]).default("upsert"),
        includeLowSeverity: z.boolean().default(false)
    })
        .default({})
});
export const defaultConfig = prismConfigSchema.parse({});
