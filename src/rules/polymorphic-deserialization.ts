import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; files: RegExp; pattern: RegExp; unlessFile?: RegExp };

const jvm = /\.(?:java|kt|scala|groovy)$/i;
const jvmOrSettings = /\.(?:java|kt|scala|groovy|properties|ya?ml|xml)$/i;
const dotnet = /\.(?:cs|vb|fs)$/i;

// Settings that let the data being read name the class to create, which gadget chains turn into
// running code: Jackson's default typing, fastjson's autoType, XStream's open permissions,
// Newtonsoft.Json's TypeNameHandling, .NET's SimpleTypeResolver, Kryo without registration,
// Spring's HTTP invoker, Oj's object mode, and jsonpickle.
const settings: Setting[] = [
  { label: "Jackson's default typing", files: jvm, pattern: /\.enableDefaultTyping\s*\(|\bactivateDefaultTyping(?:AsProperty)?\s*\([^)]*LaissezFaireSubTypeValidator/ },
  {
    label: "fastjson's autoType",
    files: jvmOrSettings,
    // The feature passed or set, not fastjson's own checks of it, such as `Feature.SupportAutoType.mask`,
    // `feature == Feature.SupportAutoType`, `isEnabled(...)`, imports, and its mapping of old features.
    pattern: /\.setAutoTypeSupport\s*\(\s*true\s*\)|^(?!\s*import\b)(?!.*\bisEnabled\s*\([^)]*SupportAutoType)(?!\s*\w*[Ff]eature\s*=\s*[\w.]*SupportAutoType\s*;).*(?<![=!]=\s*(?:\w+\.)*|\bcase\s+(?:\w+\.)*)\bFeature\.SupportAutoType\b(?!\s*\.mask\b|\s*[=!]=)|\bfastjson2?\.parser\.autoTypeSupport\s*[=:]\s*true\b|\bJSONReader\.autoType(?:Filter)?\s*\(\s*["']\s*["']|\.addAccept\s*\(\s*["']\s*["']\s*\)/
  },
  {
    label: "XStream's permission for every type",
    files: jvm,
    pattern: /\baddPermission\s*\(\s*(?:AnyTypePermission\.)?ANY\s*\)|\ballowTypesByWildcard\s*\([^)]*["']\*\*["']|\baddPermission\s*\(\s*new\s+AnyTypePermission\s*\(/
  },
  {
    label: "Newtonsoft.Json's TypeNameHandling",
    files: dotnet,
    pattern: /\bTypeNameHandling\s*=\s*TypeNameHandling\.(?:All|Auto|Objects|Arrays)\b/,
    // A binder that allows only known types closes the hole.
    unlessFile: /\b(?:SerializationBinder|ISerializationBinder|Binder)\s*=/
  },
  { label: ".NET's SimpleTypeResolver", files: dotnet, pattern: /\bnew\s+JavaScriptSerializer\s*\(\s*new\s+SimpleTypeResolver\s*\(/ },
  { label: "Kryo without class registration", files: jvm, pattern: /\.setRegistrationRequired\s*\(\s*false\s*\)/ },
  { label: "Spring's HTTP invoker", files: jvmOrSettings, pattern: /\b(?:Simple)?HttpInvokerServiceExporter\b/ },
  { label: "Oj's object mode", files: /\.rb$/i, pattern: /\bOj\.(?:load|default_options\s*=)[^\n]*\bmode:\s*:object\b|\bOj\.default_options\s*=\s*\{[^}]*:mode\s*=>\s*:object/ },
  { label: "jsonpickle", files: /\.py$/i, pattern: /\bjsonpickle\.(?:decode|loads)\s*\((?![^)]*\bsafe\s*=\s*True)/ }
];

const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|<!--|')/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const polymorphicDeserializationRule: Rule = {
  id: "polymorphic-deserialization",
  description: "Flags deserializer settings that let the data being read choose which classes to create, such as Jackson's default typing, fastjson's autoType, and Newtonsoft.Json's TypeNameHandling.",
  run({ files, config }) {
    if (!config.rules.polymorphicDeserialization.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      if (
        fileSettings.length === 0 ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        // Development, example, and test code.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ unlessFile }) => unlessFile === undefined || !unlessFile.test(text));
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; label: string }> = [];
      let inDocstring = false;
      for (const { line, content, added, startsHunk } of lines) {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|'''/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (wasInDocstring || !added || content.length > maxLineLength || commentLine.test(content)) {
          continue;
        }
        const setting = active.find(({ pattern }) => pattern.test(content));
        if (setting !== undefined) {
          found.push({ line, label: setting.label });
        }
      }
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text: where, plural } = describeLines(lineNumbers);
      const labels = [...new Set(found.map(({ label }) => label))];
      return [
        {
          ruleId: "polymorphic-deserialization",
          title: "Data chooses the classes to create",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "turn" : "turns"} on ${listOf(labels)}, which ${plural || labels.length > 1 ? "let" : "lets"} the data being read name the classes to create, so anyone who can send that data can chain classes on the classpath into running their own code on the server.`,
          recommendation:
            "Read untrusted data into fixed types instead. Where a field must hold several types, allow only those: Jackson's `@JsonTypeInfo(use = Id.NAME)` with `@JsonSubTypes` or a `BasicPolymorphicTypeValidator`, fastjson's safe mode, XStream's `allowTypes`, a Newtonsoft.Json `ISerializationBinder`, and Kryo's class registration. Replace Spring's HTTP invoker with JSON over HTTP."
        }
      ];
    });
  }
};
