import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { untrustedModelCodeRule } from "../../src/rules/untrusted-model-code.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return untrustedModelCodeRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testUntrustedModelCodeReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/model.py", [
      "from transformers import AutoModelForCausalLM",
      "",
      "model = AutoModelForCausalLM.from_pretrained(MODEL_ID, trust_remote_code=True)",
      "state = torch.load(checkpoint_path, map_location=\"cpu\", weights_only=False)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Model loading runs code from the model's files");
  assert.deepEqual(finding?.lines, [3, 4]);
  assert.equal(
    finding?.message,
    "Lines 3, 4 load models with `trust_remote_code` on and `weights_only=False`, so loading a model runs code that comes with its files, either Python files from its Hugging Face repository or pickled objects in a checkpoint. Whoever can change those files, such as the model's publisher, someone who takes over their account, or anyone who can replace a file in storage or a download cache, can run their own code in this process with its data and credentials."
  );
}

export function testUntrustedModelCodeReadsEachLoader(): void {
  const cases: Array<[string, string[]]> = [
    ["app/data.py", ["dataset = load_dataset(name, split=\"train\", trust_remote_code=True)"]],
    ["app/serve.py", ["llm = LLM(model=model_name, kwargs={\"trust_remote_code\": True})"]],
    ["app/features.py", ["embeddings = np.load(path, allow_pickle=True)"]],
    ["app/features.py", ["embeddings = np.load(", "    path,", "    allow_pickle=True,", ")"]],
    ["app/model.py", ["model = keras.models.load_model(path, safe_mode=False)"]],
    ["app/model.py", ["keras.config.enable_unsafe_deserialization()"]],
    ["deploy/serve.sh", ["vllm serve \"$MODEL\" --tensor-parallel-size 2 --trust-remote-code"]],
    ["Dockerfile", ["CMD [\"--model-id\", \"acme/chat\", \"--trust-remote-code\"]"]],
    ["deploy/vllm.yaml", ["        args:", "          - --model=acme/chat", "          - --trust-remote-code"]],
    ["scripts/eval.sh", ["lm_eval --model hf --model_args pretrained=acme/chat,trust_remote_code=True --tasks hellaswag"]],
    ["configs/train.yaml", ["base_model: acme/chat", "trust_remote_code: true"]],
    ["docker-compose.yml", ["    environment:", "      - TRUST_REMOTE_CODE=true"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testUntrustedModelCodeSkipsSafeLoading(): void {
  const cases: Array<[string, string[]]> = [
    // Defaults and safe settings.
    ["app/model.py", ["model = AutoModelForCausalLM.from_pretrained(MODEL_ID, trust_remote_code=False)"]],
    ["app/model.py", ["state = torch.load(checkpoint_path, weights_only=True)"]],
    ["app/model.py", ["model = keras.models.load_model(path)"]],
    ["deploy/serve.sh", ["vllm serve \"$MODEL\" --trust-remote-code=false"]],
    ["configs/train.yaml", ["trust_remote_code: false"]],
    // Remote code pinned to a reviewed commit.
    [
      "app/model.py",
      ["model = AutoModel.from_pretrained(", "    MODEL_ID,", "    revision=\"3f1c2d9e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e\",", "    trust_remote_code=True,", ")"]
    ],
    // Saving with pickles, and options of other functions.
    ["app/features.py", ["np.save(path, embeddings, allow_pickle=True)"]],
    ["app/views.py", ["render(request, safe_mode=False)"]],
    // Definitions, help text, comments, and docstrings.
    ["app/cli.py", ["def load(path: str, weights_only=False):"]],
    ["app/cli.py", ["parser.add_argument(\"--trust-remote-code\", action=\"store_true\", help=\"Pass trust_remote_code=True to from_pretrained.\")"]],
    ["app/model.py", ["# model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True)"]],
    ["app/model.py", ["log.warning(\"The model type is unknown. \\", "    This is expected if the model needs `trust_remote_code=True`.\")"]],
    // Variables that a later call reads.
    ["app/io.py", ["    weights_only = False"]],
    ["app/model.py", ["def build():", "    \"\"\"Load the model.", "", "    >>> AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True)", "    \"\"\"", "    return None"]],
    // Examples, notebooks, and documentation.
    ["examples/chat.py", ["model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True)"]],
    ["notebooks/chat.ipynb", ["    \"model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True)\""]],
    ["docs/serving.md", ["vllm serve acme/chat --trust-remote-code"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testUntrustedModelCodeSkipsTestsAndCanBeDisabled(): void {
  const lines = ["model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True)"];
  assert.deepEqual(findings([added("tests/test_model.py", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { untrustedModelCode: { enabled: false } } });
  assert.deepEqual(findings([added("app/model.py", lines)], config), []);
}
