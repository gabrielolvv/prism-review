import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "variable" | "unmarked";
type Found = { line: number; kind: Kind; name: string };

const terraformFile = /\.tf$/i;
// Test setups, including Enos, the end-to-end test framework of HashiCorp's products.
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ|inttest|tests?|fixtures?|examples?|samples?|demos?|testdata|enos)(?:[\/_.-]|$)|(?:^|\/)(?:hack|docs?)\//i;

// Variable names that end in a secret, such as `db_password` or `GITHUB_TOKEN`, as opposed to settings
// about one, such as `password_length` or `secret_name`.
const secretName =
  /(?:^|[_-])(?:password|passwd|pwd|secret|client_secret|token|api_?key|apikey|private_?key|access_?key|secret_?key|signing_?key|ssh_?key|deploy_?key|passphrase|credentials?|connection_?string|conn_?str|webhook_?url|sas)$/i;
// Descriptions of a secret's name, location, or identifier rather than its value.
const describesReference =
  /\b(?:name|names|arn|arns|id|ids|ocid|path|url|uri|reference|location|key id)\s+(?:of|for|to|where|that|in|containing)\b|\b(?:secret|secrets manager|key vault|parameter|parameter store|ssm|vault|chamber)\s+(?:name|arn|id|path|reference|key)\b|\bwhether\b|\benable\b|\bif true\b/i;
const variableStart = /^\s*variable\s+"([^"]+)"\s*\{/;
const markedKey = /^\s*(?:sensitive|ephemeral)\s*=\s*true\b/;
const nonSecretType = /^\s*type\s*=\s*(?:bool|number|object\s*\(|map\s*\(\s*object|list\s*\(\s*object)/;
const literalDefault = /^\s*default\s*=\s*(?:true|false|-?\d+(?:\.\d+)?|null)\s*$/;

// `nonsensitive(...)` around a value named for a secret. Comparisons and hashes of a secret, and map keys,
// reveal nothing and are the function's usual use.
const nonsensitiveCall = /\bnonsensitive\s*\(/g;
const secretExpression = /password|passwd|secret|token|private_?key|api_?key|access_?key|deploy_?key|passphrase|credential/i;
const harmless = /^\s*(?:keys|length|toset\s*\(\s*keys|sha\d*|md5|base64sha\d*|bcrypt|can|type)\s*\(|\b(?:_?names?|_?arns?|_?ids?|_?length|_?keys)\b\s*\)?\s*$/i;
const commentLine = /^\s*(?:#|\/\/)/;

// The lines of the block that starts at `index`, by brace depth.
function blockAt(lines: PatchLine[], index: number): PatchLine[] {
  const block: PatchLine[] = [];
  let depth = 0;
  for (const line of lines.slice(index, index + 40)) {
    if (block.length > 0 && line.startsHunk) {
      break;
    }
    block.push(line);
    depth += (line.content.match(/\{/g)?.length ?? 0) - (line.content.match(/\}/g)?.length ?? 0);
    if (depth <= 0) {
      break;
    }
  }
  return block;
}

// The argument of the call that opens at `start`, by parenthesis depth, on one line.
function argumentAt(content: string, start: number): { text: string; end: number } {
  let depth = 1;
  let index = start;
  while (index < content.length && depth > 0) {
    depth += content[index] === "(" ? 1 : content[index] === ")" ? -1 : 0;
    index += 1;
  }
  return { text: content.slice(start, depth === 0 ? index - 1 : index), end: index };
}

function unmarkedVariables(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  lines.forEach(({ line, content, added }, index) => {
    const name = variableStart.exec(content)?.[1];
    if (!added || name === undefined || !secretName.test(name) || /public/i.test(name)) {
      return;
    }
    const block = blockAt(lines, index).map(({ content: text }) => text);
    const description = block.find((text) => /^\s*description\s*=/.test(text)) ?? "";
    if (
      block.some((text) => markedKey.test(text) || nonSecretType.test(text) || literalDefault.test(text)) ||
      // One-line blocks, such as `variable "token" { sensitive = true }`.
      /\b(?:sensitive|ephemeral)\s*=\s*true\b/.test(content) ||
      describesReference.test(description)
    ) {
      return;
    }
    found.push({ line, kind: "variable", name });
  });
  return found;
}

function unmarkedSecrets(lines: PatchLine[]): Found[] {
  const found: Found[] = [];
  for (const { line, content, added } of lines) {
    if (!added || commentLine.test(content)) {
      continue;
    }
    for (const match of content.matchAll(nonsensitiveCall)) {
      const start = (match.index ?? 0) + match[0].length;
      const { text, end } = argumentAt(content, start);
      const rest = content.slice(end);
      if (secretExpression.test(text) && !harmless.test(text) && !/^\s*(?:==|!=|>|<)/.test(rest)) {
        found.push({ line, kind: "unmarked", name: text.trim() });
      }
    }
  }
  return found;
}

const phrases: Record<Kind, string> = {
  variable: "declares Terraform variables named for secrets without `sensitive = true`, so their values appear in `plan` and `apply` output, and in CI logs, wherever a resource uses them in a setting the provider does not hide",
  unmarked: "removes Terraform's redaction from secrets with `nonsensitive()`, so `plan` and `apply` print them"
};

export const terraformSensitiveValueRule: Rule = {
  id: "terraform-sensitive-value",
  description:
    "Warns about Terraform secrets left visible in `plan` and `apply` output: variables named for a password, token, or key without `sensitive = true`, and secrets passed through `nonsensitive()`.",
  run({ files, config }) {
    if (!config.rules.terraformSensitiveValue.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !terraformFile.test(file.path) ||
        file.patch === undefined ||
        ciOrTestSetup.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const found = [...unmarkedVariables(lines), ...unmarkedSecrets(lines)];
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))].sort((left, right) => left - right);
      const { text } = describeLines(lineNumbers);
      const kinds = (Object.keys(phrases) as Kind[]).filter((kind) => found.some((entry) => entry.kind === kind));
      const names = [...new Set(found.map(({ name }) => `\`${name}\``))];
      const named = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
      return [
        {
          ruleId: "terraform-sensitive-value",
          title: "Terraform secret shown in plan output",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the change ${listOf(kinds.map((kind) => phrases[kind]))}: ${listOf(named)}.`,
          recommendation:
            "Add `sensitive = true` to variables that hold secrets, or `ephemeral = true` on Terraform 1.10 and later for values that should stay out of the state too. Pass secrets to Helm with `set_sensitive`, and keep `nonsensitive()` for values that reveal nothing, such as a map's keys or a comparison."
        }
      ];
    });
  }
};
