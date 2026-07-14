import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { defaultConfig, prismConfigSchema } from "./schema.js";
export function loadConfig(configPath) {
    if (!configPath || !existsSync(configPath)) {
        return defaultConfig;
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = parse(raw) ?? {};
    return prismConfigSchema.parse(parsed);
}
