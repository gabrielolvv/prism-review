import assert from "node:assert/strict";
import { readInputs } from "../../src/action/inputs.js";

export function testReadInputsReadsRunnerVariableNames(): void {
  // The runner keeps hyphens in input names: `github-token` becomes INPUT_GITHUB-TOKEN.
  withInputs(
    { "INPUT_GITHUB-TOKEN": "test-token", "INPUT_CONFIG-PATH": "config/prism.yml", "INPUT_DRY-RUN": "true" },
    () => {
      assert.deepEqual(readInputs(), {
        githubToken: "test-token",
        configPath: "config/prism.yml",
        dryRun: true
      });
    }
  );
}

export function testReadInputsDefaultsConfigPath(): void {
  withInputs({ "INPUT_GITHUB-TOKEN": "test-token" }, () => {
    assert.equal(readInputs().configPath, ".prism-review.yml");
  });
}

export function testReadInputsNormalizesConfigPath(): void {
  withInputs({ "INPUT_GITHUB-TOKEN": "test-token", "INPUT_CONFIG-PATH": "./config/prism.yml" }, () => {
    assert.equal(readInputs().configPath, "config/prism.yml");
  });
}

export function testReadInputsRejectsPathsOutsideRepository(): void {
  for (const configPath of ["../shared/prism.yml", "/etc/prism.yml", "C:/prism.yml", "config//prism.yml"]) {
    withInputs({ "INPUT_GITHUB-TOKEN": "test-token", "INPUT_CONFIG-PATH": configPath }, () => {
      assert.throws(
        () => readInputs(),
        /config-path must be a relative path inside the repository/,
        configPath
      );
    });
  }
}

function withInputs(values: Record<string, string>, run: () => void): void {
  const names = ["INPUT_GITHUB-TOKEN", "INPUT_CONFIG-PATH", "INPUT_DRY-RUN"];
  const previous = new Map(names.map((name) => [name, process.env[name]]));

  for (const name of names) {
    delete process.env[name];
  }
  Object.assign(process.env, values);

  try {
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}
