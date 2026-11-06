import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";
import { continuedQuote, insideString } from "./llm-code-execution.js";

// `remote` settings run the Python files in a model's Hugging Face repository; the others unpickle
// objects stored in the model's files.
type Setting = { label: string; files: RegExp; pattern: RegExp; remote?: boolean; context?: RegExp };

const python = /\.py$/i;
// Shell scripts, Dockerfiles, Compose and Kubernetes files, Makefiles, and settings files.
const commandsAndSettings = /\.(?:sh|bash|ya?ml|json|toml|cfg|ini|env)$|(?:^|\/)(?:Dockerfile[^/]*|Containerfile|Makefile|Procfile|\.env[^/]*)$/i;

const settings: Setting[] = [
  // Hugging Face's `trust_remote_code`, in Transformers, Datasets, sentence-transformers, vLLM, and
  // other libraries that load models from the Hub.
  { label: "`trust_remote_code` on", files: python, pattern: /\btrust_remote_code\s*=\s*True\b|["']trust_remote_code["']\s*:\s*True\b/, remote: true },
  // vLLM's, SGLang's, Text Generation Inference's, and lm-evaluation-harness' command-line flags,
  // `trust_remote_code=True` in `--model_args`, and settings files and environment variables.
  {
    label: "`trust_remote_code` on",
    files: commandsAndSettings,
    pattern:
      /(?:^|[\s"'[,=])--trust[-_]remote[-_]code\b(?!\s*(?:=|\s)\s*["']?(?:false|0)\b)|\btrust_remote_code\s*=\s*True\b|\btrust_remote_code["']?\s*[:=]\s*["']?(?:true|1)\b/i,
    remote: true
  },
  // PyTorch's pickle loading, the default before PyTorch 2.6.
  { label: "`weights_only=False`", files: python, pattern: /\bweights_only\s*=\s*False\b/ },
  // NumPy's pickled object arrays, on a load call rather than a save.
  { label: "`allow_pickle=True`", files: python, pattern: /\ballow_pickle\s*=\s*True\b/, context: /\bload\s*\(/ },
  // Keras' Lambda layers and custom objects, which run code from the saved model.
  { label: "Keras' `safe_mode=False`", files: python, pattern: /\bsafe_mode\s*=\s*False\b/, context: /\b(?:load_model|load_weights|deserialize\w*|from_config|load)\s*\(/ },
  { label: "Keras' unsafe deserialization", files: python, pattern: /\benable_unsafe_deserialization\s*\(\s*\)/ }
];
const contextWindow = 3;
// `trust_remote_code` with the code pinned to a reviewed commit.
const pinnedRevision = /\b(?:code_)?revision["']?\s*[=:]\s*["']?[0-9a-f]{40}\b|--(?:code[-_])?revision[=\s]+["']?[0-9a-f]{40}\b/i;
const pinnedWindow = 5;

const commentLine = /^\s*(?:#|\/\/|;)/;
// Class and function definitions and imports name the settings without using them.
const definition = /^\s*(?:class|def|async\s+def|from|import)\b/;
// A plain `weights_only = False` or `trust_remote_code = True` assignment sets a variable, not an option.
const variableAssignment = /^\s*\w+\s*=\s*(?:True|False)\s*(?:#.*)?$/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?|ipynb)$/i;
const maxLineLength = 2_000;

export const untrustedModelCodeRule: Rule = {
  id: "untrusted-model-code",
  description: "Flags model loading that runs code from the model's files, such as Hugging Face's `trust_remote_code=True` and PyTorch's `weights_only=False`.",
  run({ files, config }) {
    if (!config.rules.untrustedModelCode.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        // Development, example, and test code.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const isPython = python.test(file.path);
      const lines = patchLines(file.patch);
      const contents = lines.map(({ content }) => content);
      const found: Array<{ line: number; label: string }> = [];
      // Python docstrings hold usage examples, as Transformers' do.
      let inDocstring = false;
      // The quote of a string the previous line continued with a trailing backslash.
      let openQuote: string | undefined;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
          openQuote = undefined;
        }
        const wasInDocstring = inDocstring;
        const startQuote = openQuote;
        if (isPython && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        openQuote = isPython && !inDocstring ? continuedQuote(content, startQuote) : undefined;
        if (
          wasInDocstring ||
          !added ||
          content.length > maxLineLength ||
          commentLine.test(content) ||
          (isPython && (definition.test(content) || variableAssignment.test(content)))
        ) {
          return;
        }
        const setting = fileSettings.find(({ pattern, remote, context }) => {
          const match = pattern.exec(content);
          if (match === null || (isPython && insideString(content, match.index, startQuote))) {
            return false;
          }
          if (context !== undefined && !contents.slice(Math.max(0, index - contextWindow), index + 1).some((before) => context.test(before))) {
            return false;
          }
          return !(remote === true && contents.slice(Math.max(0, index - pinnedWindow), index + pinnedWindow + 1).some((near) => pinnedRevision.test(near)));
        });
        if (setting !== undefined) {
          found.push({ line, label: setting.label });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "untrusted-model-code",
          title: "Model loading runs code from the model's files",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "load" : "loads"} models with ${listOf(labels)}, so loading a model runs code that comes with its files, either Python files from its Hugging Face repository or pickled objects in a checkpoint. Whoever can change those files, such as the model's publisher, someone who takes over their account, or anyone who can replace a file in storage or a download cache, can run their own code in this process with its data and credentials.`,
          recommendation:
            "Prefer models whose architecture the installed library already supports, and when `trust_remote_code` is needed, pin `revision` to a commit hash whose code you have reviewed. Load weights from safetensors, keep `torch.load`'s default `weights_only=True`, `np.load`'s default `allow_pickle=False`, and Keras' `safe_mode`, and load pickled checkpoints only from storage you control."
        }
      ];
    });
  }
};
