import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Setting = { label: string; high: boolean; terraform?: RegExp; cloudFormation?: RegExp };

const terraformFile = /\.(?:tf|tf\.json|hcl)$/i;
// CloudFormation templates and IAM policy documents.
const templateFile = /\.(?:json|ya?ml)$/i;

// In the order the message lists them.
const settings: Setting[] = [
  {
    label: "allows every action in an IAM policy",
    high: true,
    // `actions` in a policy document, `Action` in jsonencode(), and `"Action"` in heredoc JSON.
    terraform: /\bactions\s*=\s*\[\s*"\*(?::\*)?"\s*\]|(?:\bAction|"Action")\s*[=:]\s*(?:\[\s*)?"\*(?::\*)?"\s*(?:\]|,|$)/,
    cloudFormation: /["']?\bAction["']?\s*:\s*(?:\[\s*)?["']\*(?::\*)?["']\s*(?:\]|,|$)|^\s*Action\s*:\s*\*\s*$/
  },
  {
    label: "turns off encryption",
    high: false,
    terraform:
      /\b(?:encrypted|storage_encrypted|at_rest_encryption_enabled|transit_encryption_enabled|enable_https_traffic_only|https_traffic_only_enabled|encryption_enabled)\s*=\s*false\b/,
    cloudFormation: /\b(?:Encrypted|StorageEncrypted|AtRestEncryptionEnabled|TransitEncryptionEnabled|KmsEncrypted)["']?\s*:\s*["']?false\b/
  },
  {
    label: "allows TLS 1.0 or 1.1",
    high: false,
    terraform: /\b(?:min_tls_version|minimum_tls_version|minimal_tls_version)\s*=\s*"(?:TLS)?_?1[._][01]"/i
  },
  {
    label: "turns off audit logging",
    high: false,
    terraform: /\b(?:enable_logging|enable_log_file_validation)\s*=\s*false\b/,
    cloudFormation: /\b(?:IsLogging|EnableLogFileValidation)["']?\s*:\s*["']?false\b/
  },
  {
    label: "allows the instance metadata service without a token (IMDSv1)",
    high: false,
    terraform: /\bhttp_tokens\s*=\s*"optional"/,
    cloudFormation: /\bHttpTokens["']?\s*:\s*["']?optional\b/
  }
];

const allowsEverything = settings[0] as Setting;
const commentLine = /^\s*(?:#|\/\/)/;
const effect = /\b[Ee]ffect["']?\s*[=:]\s*["']?(Allow|Deny)\b/;
// How far a statement's Effect may be from its Action, in lines the diff shows.
const statementReach = 15;

export const insecureInfrastructureRule: Rule = {
  id: "insecure-infrastructure",
  description: "Flags IAM policies that allow every action, and turned-off encryption, TLS, audit logging, and IMDSv2.",
  run({ files, config }) {
    if (!config.rules.insecureInfrastructure.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      const terraform = terraformFile.test(file.path);
      if (
        file.patch === undefined ||
        (!terraform && !templateFile.test(file.path)) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findSettings(patchLines(file.patch), terraform);
      if (found.length === 0) {
        return [];
      }

      const listed = settings.filter((setting) => found.some((match) => match.setting === setting));
      const high = listed.some((setting) => setting.high);
      const { text, plural } = describeLines(found.map((match) => match.line));
      return [
        {
          ruleId: "insecure-infrastructure",
          title: high ? "Policy allows every action" : "Infrastructure protection turned off",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "change" : "changes"} infrastructure so that it ${joinLabels(listed.map((setting) => setting.label))}.`,
          recommendation:
            "Grant only the actions a role needs, keep encryption at rest and in transit on, require TLS 1.2 or later, keep audit logs on, and require IMDSv2 tokens with http_tokens = \"required\"."
        }
      ];
    });
  }
};

function findSettings(lines: PatchLine[], terraform: boolean): Array<{ line: number; setting: Setting }> {
  const found: Array<{ line: number; setting: Setting }> = [];

  for (const [index, { line, content, added }] of lines.entries()) {
    if (!added || commentLine.test(content)) {
      continue;
    }

    for (const setting of settings) {
      const pattern = terraform ? setting.terraform : setting.cloudFormation;
      if (pattern === undefined || !pattern.test(content)) {
        continue;
      }
      // A statement that denies every action, as in a guardrail policy, takes access away.
      if (setting === allowsEverything && nearestEffect(lines, index) === "Deny") {
        continue;
      }
      found.push({ line, setting });
    }
  }

  return found;
}

// The Effect closest to a line, before or after it, within its hunk: the next hunk is elsewhere
// in the file.
function nearestEffect(lines: PatchLine[], index: number): string | undefined {
  let first = index;
  while (first > 0 && !lines[first]?.startsHunk) {
    first -= 1;
  }
  let last = index;
  while (last + 1 < lines.length && !lines[last + 1]?.startsHunk) {
    last += 1;
  }

  for (let distance = 0; distance <= statementReach; distance += 1) {
    for (const candidate of [index - distance, index + distance]) {
      if (candidate < first || candidate > last) {
        continue;
      }
      const match = effect.exec(lines[candidate]?.content ?? "")?.[1];
      if (match !== undefined) {
        return match;
      }
    }
  }
  return undefined;
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}
