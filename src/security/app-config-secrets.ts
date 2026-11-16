import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isSecretValue } from "./deployment-env-secrets.js";

// A password, token, or key written into an application's configuration, by the setting that holds it.
export type ConfigSecretLine = { line: number; name: string };

const springFile = /(?:^|\/)(?:application|bootstrap)(?:-[\w.-]+)?\.(?:properties|ya?ml)$/i;
const dotnetJson = /(?:^|\/)appsettings(?:\.[\w-]+)?\.json$/i;
const dotnetXml = /(?:^|\/)(?:web|app)(?:\.[\w-]+)?\.config$/i;
const djangoSettings = /(?:^|\/)(?:settings(?:_[\w-]+)?|settings\/[\w-]+|local_settings|prod(?:uction)?_settings)\.py$/i;
const railsDatabase = /(?:^|\/)config\/database\.ya?ml$/i;
const laravelConfig = /(?:^|\/)config\/[\w-]+\.php$/i;
// node-config's settings for every environment and for production.
const nodeConfig = /(?:^|\/)config\/(?:default|production|prod|staging)(?:[.-][\w-]+)?\.json$/i;

// Jasypt's and Spring Cloud Config's encrypted values.
const encrypted = /^(?:ENC|enc)\(|^\{cipher\}/;
const propertiesEntry = /^\s*([\w.[\]-]+)\s*[=:]\s*(.*)$/;
const yamlEntry = /^\s*-?\s*["']?([\w.-]+)["']?\s*:\s*(.+?)\s*$/;
const jsonEntry = /^\s*"([\w.:-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/;
// `Password=...;` and `Pwd=...;` in ADO.NET, JDBC, and ODBC connection strings.
const connectionPassword = /(?:^|;)\s*(?:Password|Pwd)\s*=\s*([^;"']+)/i;
const xmlSetting = /<add\s+(?:key|name)\s*=\s*"([^"]+)"\s+(?:value|connectionString)\s*=\s*"([^"]*)"/i;
// Django's `"PASSWORD": "..."` in `DATABASES`, `EMAIL_HOST_PASSWORD = "..."`, and literal defaults
// such as `os.environ.get("DB_PASSWORD", "...")`.
const pythonDictEntry = /^\s*["']([A-Z][A-Z0-9_]*)["']\s*:\s*["']([^"']*)["']\s*,?\s*(?:#.*)?$/;
const pythonAssignment = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']([^"']*)["']\s*(?:#.*)?$/;
const environmentDefault = /\b(?:getenv|environ\.get|env)\s*\(\s*["']([A-Za-z_]\w*)["']\s*,\s*["']([^"']*)["']\s*\)/;
// Laravel's `'password' => '...'`.
const phpArrayEntry = /^\s*["']([\w.-]+)["']\s*=>\s*["']([^"']*)["']\s*,?\s*$/;
// Covered by `hardcoded-session-secret`.
const sessionSecret = /^(?:SECRET_KEY|secret_key_base)$/i;
const railsLocalSection = /^(?:development|test|local|ci|default)\w*:/i;
const commentLine = /^\s*(?:#|\/\/|;|<!--|\*)/;

function secret(name: string, value: string): boolean {
  return !encrypted.test(value.trim().replace(/^["']/, "")) && !sessionSecret.test(name) && isSecretValue(name, value);
}

// The last part of a dotted key, such as `password` in `spring.datasource.password`.
function leaf(key: string): string {
  return key.split(".").at(-1) ?? key;
}

function lineSecrets(lines: PatchLine[], read: (content: string, index: number) => string | undefined): ConfigSecretLine[] {
  return lines.flatMap(({ line, content, added }, index) => {
    if (!added || commentLine.test(content)) {
      return [];
    }
    const name = read(content, index);
    return name === undefined ? [] : [{ line, name }];
  });
}

function springSecrets(path: string, lines: PatchLine[]): ConfigSecretLine[] {
  const yaml = /\.ya?ml$/i.test(path);
  return lineSecrets(lines, (content) => {
    const match = (yaml ? yamlEntry : propertiesEntry).exec(content);
    if (match === null) {
      return undefined;
    }
    const [, key = "", value = ""] = match;
    if (secret(leaf(key), value)) {
      return key;
    }
    const password = connectionPassword.exec(value);
    return password !== null && secret("password", password[1] ?? "") ? key : undefined;
  });
}

function dotnetSecrets(path: string, lines: PatchLine[]): ConfigSecretLine[] {
  const xml = dotnetXml.test(path);
  return lineSecrets(lines, (content) => {
    const match = (xml ? xmlSetting : jsonEntry).exec(content);
    if (match === null) {
      return undefined;
    }
    const [, key = "", value = ""] = match;
    const password = connectionPassword.exec(value);
    if (password !== null) {
      return secret("password", password[1] ?? "") ? key : undefined;
    }
    return secret(leaf(key.replace(/:/g, ".")), value) ? key : undefined;
  });
}

function djangoSecrets(lines: PatchLine[]): ConfigSecretLine[] {
  return lineSecrets(lines, (content) => {
    const fallback = environmentDefault.exec(content);
    if (fallback !== null) {
      return secret(fallback[1] ?? "", fallback[2] ?? "") ? fallback[1] : undefined;
    }
    const match = pythonDictEntry.exec(content) ?? pythonAssignment.exec(content);
    return match !== null && secret(match[1] ?? "", match[2] ?? "") ? match[1] : undefined;
  });
}

function railsSecrets(lines: PatchLine[]): ConfigSecretLine[] {
  // Only the sections other than development and test, such as `production:` or `staging:`.
  let localSection = false;
  return lineSecrets(
    lines.map((line) => {
      if (line.startsHunk) {
        localSection = false;
      }
      if (/^[\w-]+:/.test(line.content)) {
        localSection = railsLocalSection.test(line.content);
      }
      return { ...line, added: line.added && !localSection };
    }),
    (content) => {
      const match = yamlEntry.exec(content);
      return match !== null && secret(match[1] ?? "", match[2] ?? "") ? match[1] : undefined;
    }
  );
}

function laravelSecrets(lines: PatchLine[]): ConfigSecretLine[] {
  return lineSecrets(lines, (content) => {
    const fallback = environmentDefault.exec(content);
    if (fallback !== null) {
      return secret(fallback[1] ?? "", fallback[2] ?? "") ? fallback[1] : undefined;
    }
    const match = phpArrayEntry.exec(content);
    return match !== null && secret(match[1] ?? "", match[2] ?? "") ? match[1] : undefined;
  });
}

function nodeSecrets(lines: PatchLine[]): ConfigSecretLine[] {
  return lineSecrets(lines, (content) => {
    const match = jsonEntry.exec(content);
    return match !== null && secret(match[1] ?? "", match[2] ?? "") ? match[1] : undefined;
  });
}

// Added lines that write a password, token, or key into an application's configuration: Spring
// Boot, ASP.NET, Django, Rails, Laravel, and node-config. Runs before redaction, which hides the values.
export function findAppConfigSecretLines(path: string, patch: string): ConfigSecretLine[] {
  if (springFile.test(path)) {
    return springSecrets(path, patchLines(patch));
  }
  if (dotnetJson.test(path) || dotnetXml.test(path)) {
    return dotnetSecrets(path, patchLines(patch));
  }
  if (djangoSettings.test(path)) {
    return djangoSecrets(patchLines(patch));
  }
  if (railsDatabase.test(path)) {
    return railsSecrets(patchLines(patch));
  }
  if (laravelConfig.test(path)) {
    return laravelSecrets(patchLines(patch));
  }
  if (nodeConfig.test(path)) {
    return nodeSecrets(patchLines(patch));
  }
  return [];
}
