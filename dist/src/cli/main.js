import { resolve } from "node:path";
import { analyzePullRequest } from "../analysis/analyze-pull-request.js";
import { loadConfig } from "../config/load-config.js";
import { renderMarkdown } from "../reporting/render-markdown.js";
import { loadDiffFixture } from "../testing/fixture-loader.js";
async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (command !== "analyze") {
        printUsage();
        process.exitCode = 1;
        return;
    }
    const options = parseArgs(args);
    if (!options.fixture) {
        throw new Error("Missing required --fixture option.");
    }
    const files = loadDiffFixture(resolve(options.fixture));
    const config = loadConfig(options.config ? resolve(options.config) : ".prism-review.yml");
    const result = analyzePullRequest(files, config);
    process.stdout.write(`${renderMarkdown(result)}\n`);
}
function parseArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        const next = args[index + 1];
        if (arg === "--fixture") {
            options.fixture = next;
            index += 1;
        }
        if (arg === "--config") {
            options.config = next;
            index += 1;
        }
    }
    return options;
}
function printUsage() {
    process.stdout.write("Usage: prism-review analyze --fixture <path> [--config <path>]\n");
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Prism Review failed: ${message}\n`);
    process.exitCode = 1;
});
