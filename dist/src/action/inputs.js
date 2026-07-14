export function readInputs() {
    const githubToken = getRequiredInput("github-token");
    return {
        githubToken,
        configPath: getInput("config-path") || ".prism-review.yml",
        dryRun: parseBooleanInput(getInput("dry-run") || "false")
    };
}
function getInput(name) {
    const envName = `INPUT_${name.replace(/ /g, "_").replace(/-/g, "_").toUpperCase()}`;
    return process.env[envName]?.trim() ?? "";
}
function getRequiredInput(name) {
    const value = getInput(name);
    if (!value) {
        throw new Error(`Missing required input: ${name}`);
    }
    return value;
}
function parseBooleanInput(value) {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
