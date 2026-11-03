import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// A minimum below 8, the least NIST SP 800-63B allows. 0 and 1 are left out: a minimum of 1 only
// makes the field required, as login forms check it.
const short = String.raw`([2-7])`;

// A name for a new password, not the current one a login or change form asks for.
const passwordName = String.raw`(?<![\w$])(?!(?:current|old)_?password)(?:new_?)?password(?:_?(?:confirm(?:ation)?|1|2))?\b`;
const passwordNameInsensitive = new RegExp(passwordName, "i");

type Kind = "short" | "off";

// In the order the message lists them.
const labels: Record<Kind, [string, string]> = {
  short: ["allows passwords shorter than 8 characters", "allow passwords shorter than 8 characters"],
  off: ["turns Django's password validators off", "turn Django's password validators off"]
};

// Django's validators turned off.
const validatorsOff = /^\s*AUTH_PASSWORD_VALIDATORS\s*=\s*\[\s*\]/;

const settings: Array<{ files: RegExp; pattern: RegExp }> = [
  // A short MinimumLengthValidator, and django-allauth's setting.
  { files: /\.py$/i, pattern: new RegExp(String.raw`["']min_length["']\s*:\s*${short}\b|^\s*ACCOUNT_PASSWORD_MIN_LENGTH\s*=\s*${short}\b`) },
  // pydantic, marshmallow, and WTForms fields for a password.
  { files: /\.py$/i, pattern: new RegExp(String.raw`${passwordName}\w*\s*[:=].*\b(?:min_length|min)\s*=\s*${short}\b`, "i") },
  // Devise, Rails validations, and Rodauth.
  {
    files: /\.rb$/i,
    pattern: new RegExp(
      String.raw`\bconfig\.password_length\s*=\s*${short}\s*\.\.|\bvalidates\s+:password\b.*(?:\bminimum:\s*${short}\b|\b(?:in|within):\s*${short}\s*\.\.)|\bpassword_minimum_length\s*\(?\s*${short}\b`
    )
  },
  // ASP.NET Core Identity.
  { files: /\.cs$/i, pattern: new RegExp(String.raw`\bRequiredLength\s*=\s*${short}\s*[;,}]`) },
  // Joi, yup, zod, and Mongoose schemas, and express-validator.
  {
    files: /\.(?:[cm]?[jt]sx?|vue)$/i,
    pattern: new RegExp(
      String.raw`${passwordName}\w*["']?\s*:\s*[^;\n]*?\.min\(\s*${short}\s*[,)]|${passwordName}\w*["']?\s*:\s*\{[^}]*\bmin[Ll]ength\s*:\s*\[?\s*${short}\b|${passwordName}["']\s*\)\s*\.isLength\(\s*\{\s*min\s*:\s*${short}\b`,
      "i"
    )
  },
  // Laravel validation rules and the Password rule.
  {
    files: /\.php$/i,
    pattern: new RegExp(String.raw`["']${passwordName}["']\s*=>\s*[^\n]*\bmin:${short}\b|\bPassword::min\(\s*${short}\s*\)`, "i")
  },
  // AWS IAM account and Cognito password policies.
  {
    files: /\.(?:tf|tf\.json|ya?ml|json)$/i,
    pattern: new RegExp(String.raw`\bminimum_password_length\s*=\s*${short}\b|\bMinimumPasswordLength["']?\s*:\s*${short}\b`)
  }
];

// Annotations above a password field: class-validator's @MinLength, and Bean Validation's @Size and
// Hibernate's @Length.
const annotation = new RegExp(String.raw`@MinLength\(\s*${short}\s*[,)]|@(?:Size|Length)\s*\([^)]*\bmin\s*=\s*${short}\b`);
const annotatedFiles = /\.(?:[cm]?[jt]sx?|java|kt)$/i;
const fieldWindow = 3;

// Cognito's minimum_length and MinimumLength inside a password policy block.
const cognitoLength = new RegExp(String.raw`^\s*["']?(?:minimum_length|MinimumLength)["']?\s*[=:]\s*${short}\b`);
const passwordPolicy = /password_policy|PasswordPolicy/;
const policyWindow = 6;

// Django's own defaults file sets AUTH_PASSWORD_VALIDATORS to an empty list.
const djangoDefaults = /(?:^|\/)django\/conf\/global_settings\.py$/i;

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|(?:^|\/)package(?:-lock)?\.json$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const weakPasswordPolicyRule: Rule = {
  id: "weak-password-policy",
  description: "Flags password policies that allow passwords shorter than 8 characters, and Django's password validators turned off.",
  run({ files, config }) {
    if (!config.rules.weakPasswordPolicy.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const fileSettings = settings.filter(({ files: pattern }) => pattern.test(file.path));
      const python = /\.py$/i.test(file.path);
      const annotated = annotatedFiles.test(file.path);
      if (
        (fileSettings.length === 0 && !annotated) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        djangoDefaults.test(file.path) ||
        // Development, example, and test apps use short passwords on purpose.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const infrastructure = /\.(?:tf|tf\.json|ya?ml|json)$/i.test(file.path);
      const found: Array<{ line: number; kind: Kind }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content)) {
          return;
        }
        if (python && validatorsOff.test(content)) {
          found.push({ line, kind: "off" });
          return;
        }
        if (fileSettings.some(({ pattern }) => pattern.test(content))) {
          found.push({ line, kind: "short" });
          return;
        }
        if (
          annotated &&
          annotation.test(content) &&
          lines.slice(index + 1, index + 1 + fieldWindow).some(({ content: field }) => passwordNameInsensitive.test(field))
        ) {
          found.push({ line, kind: "short" });
          return;
        }
        if (
          infrastructure &&
          cognitoLength.test(content) &&
          lines.slice(Math.max(0, index - policyWindow), index).some(({ content: before }) => passwordPolicy.test(before))
        ) {
          found.push({ line, kind: "short" });
        }
      });
      if (found.length === 0) {
        return [];
      }

      const reported = found.map((match) => match.line);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(reported);
      return [
        {
          ruleId: "weak-password-policy",
          title: "Weak password policy",
          severity: "warning" as const,
          file: file.path,
          line: reported[0],
          lines: reported,
          message: `${text} ${kinds.map((kind) => labels[kind][plural ? 1 : 0]).join(", and ")}, which leaves accounts open to guessing and to the lists of leaked passwords attackers try first.`,
          recommendation:
            "Require at least 8 characters, and more for admin accounts, as NIST SP 800-63B recommends, and check new passwords against a list of common and breached ones, such as Django's `CommonPasswordValidator` or a Have I Been Pwned lookup. Long passwords and passphrases matter more than rules about digits and symbols."
        }
      ];
    });
  }
};
