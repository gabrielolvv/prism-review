import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isSecretValue } from "./deployment-env-secrets.js";

// A password, token, or key written into infrastructure code, by the setting or variable that holds it.
export type IacPasswordLine = { line: number; name: string };

const terraformFile = /\.(?:tf|tfvars|hcl)$/i;
const cloudFormationFile = /\.(?:ya?ml|json|template)$/i;
const cloudFormationTemplate = /AWSTemplateFormatVersion|["']?Type["']?\s*:\s*["']?AWS::[A-Za-z0-9]+::/;
// Ansible inventories and their host and group variables.
const ansibleVariables = /(?:^|\/)(?:group_vars|host_vars)\/[^/]+(?:\/[^/]+)?$/i;
const ansibleInventory = /(?:^|\/)(?:inventor(?:y|ies)\/(?:[^/]+\/)?[^/.]+|inventory|hosts)(?:\.(?:ya?ml|ini|cfg))?$/i;

// `password = "..."` in a resource, provider, module, `locals`, `inputs`, or a `.tfvars` file.
const terraformAttribute = /^\s*([A-Za-z_][\w-]*)\s*=\s*"((?:[^"\\]|\\.)*)"\s*(?:(?:#|\/\/).*)?$/;
const terraformVariable = /^\s*variable\s+"([^"]+)"\s*\{/;
const terraformDefault = /^\s*default\s*=\s*"((?:[^"\\]|\\.)*)"\s*(?:(?:#|\/\/).*)?$/;
const terraformDescription = /^\s*description\s*=/;
// Variables that hold where a secret is kept, such as `ssm_key_password` or "Kube Secret Name".
const storageVariable = /(?:^|_)(?:name|path|ssm|arn|kms|chamber)(?:_|$)/i;
const storageDescription = /\b(?:name|path|parameter|ssm|arn|prefix|format|location|chamber)\b/i;
// `MasterUserPassword: ...` and `"MasterUserPassword": "..."`, and a parameter's `Default`.
const keyValue = /^\s*-?\s*["']?([A-Za-z][\w-]*)["']?\s*:\s*(.+?)\s*,?\s*$/;
const blockOpener = /^(\s*)["']?([A-Za-z][\w-]*)["']?\s*:\s*\{?\s*$/;
const parameterWindow = 8;
// `host ansible_password=...` in INI inventories.
const iniVariable = /\b([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s"']+)/g;
const commentLine = /^\s*(?:#|\/\/|;)/;

function terraformPasswords(lines: PatchLine[]): IacPasswordLine[] {
  const found: IacPasswordLine[] = [];
  // A variable's default is judged once its block ends, since its description may follow it.
  let variable: { name: string; defaults: IacPasswordLine[]; describesStorage: boolean } | undefined;
  const closeVariable = () => {
    if (variable !== undefined && !variable.describesStorage && !storageVariable.test(variable.name)) {
      found.push(...variable.defaults);
    }
    variable = undefined;
  };
  for (const { line, content, added, startsHunk } of lines) {
    if (startsHunk) {
      closeVariable();
    }
    if (commentLine.test(content)) {
      continue;
    }
    const opened = terraformVariable.exec(content);
    if (opened !== null) {
      closeVariable();
      variable = { name: opened[1] ?? "", defaults: [], describesStorage: false };
      continue;
    }
    if (/^\}/.test(content)) {
      closeVariable();
      continue;
    }
    if (variable !== undefined) {
      if (terraformDescription.test(content) && storageDescription.test(content)) {
        variable.describesStorage = true;
      }
      const fallback = terraformDefault.exec(content);
      if (fallback !== null) {
        if (added && isSecretValue(variable.name, fallback[1] ?? "")) {
          variable.defaults.push({ line, name: variable.name });
        }
        continue;
      }
    }
    const attribute = terraformAttribute.exec(content);
    if (attribute !== null && added && isSecretValue(attribute[1] ?? "", attribute[2] ?? "")) {
      found.push({ line, name: attribute[1] ?? "" });
    }
  }
  closeVariable();
  return found;
}

function cloudFormationPasswords(lines: PatchLine[]): IacPasswordLine[] {
  const found: IacPasswordLine[] = [];
  // Inline code and scripts in block scalars, such as a Lambda function's `ZipFile: |`.
  let blockIndent: number | undefined;
  lines.forEach(({ line, content, added, startsHunk }, index) => {
    const indent = /^\s*/.exec(content)?.[0].length ?? 0;
    if (startsHunk || (blockIndent !== undefined && content.trim() !== "" && indent <= blockIndent)) {
      blockIndent = undefined;
    }
    if (blockIndent !== undefined) {
      return;
    }
    if (/:\s*[|>][-+0-9]*\s*$/.test(content)) {
      blockIndent = indent;
      return;
    }
    if (!added || commentLine.test(content)) {
      return;
    }
    const match = keyValue.exec(content);
    if (match === null) {
      return;
    }
    const [, key = "", value = ""] = match;
    if (key === "Default") {
      // A parameter's default, such as `DBPassword:` with `NoEcho: true` and `Default: ...`.
      const parameter = lines
        .slice(Math.max(0, index - parameterWindow), index)
        .reverse()
        .map(({ content: before }) => blockOpener.exec(before))
        .find((opener) => opener !== null && (opener[1]?.length ?? 0) < indent);
      const name = parameter?.[2] ?? "";
      if (isSecretValue(name, value)) {
        found.push({ line, name });
      }
      return;
    }
    if (isSecretValue(key, value)) {
      found.push({ line, name: key });
    }
  });
  return found;
}

function ansiblePasswords(path: string, lines: PatchLine[]): IacPasswordLine[] {
  const found: IacPasswordLine[] = [];
  const ini = !/\.ya?ml$/i.test(path);
  for (const { line, content, added } of lines) {
    if (!added || commentLine.test(content)) {
      continue;
    }
    if (ini) {
      const secret = [...content.matchAll(iniVariable)].find((match) => isSecretValue(match[1] ?? "", match[2] ?? ""));
      if (secret !== undefined) {
        found.push({ line, name: secret[1] ?? "" });
      }
      continue;
    }
    const match = keyValue.exec(content);
    if (match !== null && isSecretValue(match[1] ?? "", match[2] ?? "")) {
      found.push({ line, name: match[1] ?? "" });
    }
  }
  return found;
}

// Added lines that write a password, token, or key into Terraform, CloudFormation, or an Ansible
// inventory. Runs before redaction, which hides the values.
export function findIacPasswordLines(path: string, patch: string): IacPasswordLine[] {
  const ansible = ansibleVariables.test(path) || ansibleInventory.test(path);
  if (!terraformFile.test(path) && !cloudFormationFile.test(path) && !ansible) {
    return [];
  }
  const lines = patchLines(patch);
  if (terraformFile.test(path)) {
    return terraformPasswords(lines);
  }
  if (ansible) {
    return ansiblePasswords(path, lines);
  }
  return lines.some(({ content }) => cloudFormationTemplate.test(content)) ? cloudFormationPasswords(lines) : [];
}
