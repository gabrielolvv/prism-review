import { minimatch } from "minimatch";
const ecosystemHints = [
    [/package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock/, "Node.js"],
    [/requirements\.txt|pyproject\.toml|poetry\.lock/, "Python"],
    [/go\.(mod|sum)/, "Go"],
    [/Cargo\.(toml|lock)/, "Rust"]
];
export const dependencyRiskRule = {
    id: "dependency-risk",
    description: "Flags dependency manifest and lockfile changes for supply-chain review.",
    run({ files, config }) {
        const ruleConfig = config.rules.dependencyRisk;
        if (!ruleConfig.enabled) {
            return [];
        }
        return files
            .filter((file) => ruleConfig.manifests.some((pattern) => minimatch(file.path, pattern)))
            .map((file) => {
            const ecosystem = detectEcosystem(file.path);
            return {
                ruleId: "dependency-risk",
                title: "Dependency definition changed",
                severity: "warning",
                file: file.path,
                message: `${file.path} changes ${ecosystem} dependency metadata or lockfile state.`,
                recommendation: "Verify package provenance, lockfile consistency, license impact, and whether the dependency is required at runtime."
            };
        });
    }
};
function detectEcosystem(path) {
    const match = ecosystemHints.find(([pattern]) => pattern.test(path));
    return match?.[1] ?? "project";
}
