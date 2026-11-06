import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";
import { statementAround } from "./policy-statement.js";

// IAM actions that let whoever holds them on every resource make themselves, or a role they control,
// an administrator: pass any role to a service, rewrite or attach policies, create keys or passwords
// for other users, change who can assume a role, or assume any role.
const escalationAction =
  /["'](iam:\*|iam:PassRole|iam:CreatePolicyVersion|iam:SetDefaultPolicyVersion|iam:Attach(?:User|Role|Group)Policy|iam:Put(?:User|Role|Group)Policy|iam:CreateAccessKey|iam:CreateLoginProfile|iam:UpdateLoginProfile|iam:UpdateAssumeRolePolicy|iam:AddUserToGroup|sts:AssumeRole)["']/gi;
// Every resource, or every role, user, group, or policy in an account.
const everyResource =
  /\bresources?["']?\s*[:=]\s*\[?\s*(?:["']\*["']|["']arn:aws:iam::(?:\*|\d{12}|\$\{[^}]+\}):(?:role|user|group|policy)\/\*["'])|^\s*-\s*["']?\*["']?\s*$|^\s*-?\s*["']?Resource["']?\s*:\s*\*\s*$/im;
const deny = /["']?Effect["']?\s*[:=]\s*["']?Deny\b|\beffect\s*=\s*"Deny"|\beffect\s*:\s*(?:iam\.)?Effect\.DENY\b/i;
// Statements limited by a condition, such as `iam:PassedToService` or a permissions boundary.
const condition = /["']?Condition["']?\s*:|^\s*condition\s*\{|\bconditions\s*:/m;

const policyFile = /\.(?:json|ya?ml|template|tf|tf\.json|hcl|[cm]?[jt]s|py|java|go|cs)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ)(?:[\/_.-]|$)|__snapshots__|\.snap$|(?:^|\/)(?:hack|docs?)\//i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$|\.schema\.json$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const describesValues = /\b(?:description|help)\s*[:=]/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 2_000;

export const iamPrivilegeEscalationRule: Rule = {
  id: "iam-privilege-escalation",
  description: "Flags IAM policies that allow, on every resource and with no condition, actions that let the holder make themselves an administrator, such as `iam:PassRole` or `iam:AttachUserPolicy`.",
  run({ files, config }) {
    if (!config.rules.iamPrivilegeEscalation.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !policyFile.test(file.path) ||
        file.patch === undefined ||
        documentation.test(file.path) ||
        skippedFile.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test stacks.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const contents = lines.map(({ content }) => content);
      const found: Array<{ line: number; actions: string[] }> = [];
      lines.forEach(({ line, content, added }, index) => {
        if (!added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        const actions = [...content.matchAll(escalationAction)].map((match) => match[1] ?? "");
        if (actions.length === 0) {
          return;
        }
        const statement = statementAround(contents, index);
        // Trust policies name who may assume a role with `Principal`; they grant nothing on resources.
        if (deny.test(statement) || condition.test(statement) || /["']?Principal["']?\s*[:=]/.test(statement) || !everyResource.test(statement)) {
          return;
        }
        found.push({ line, actions });
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const actions = [...new Set(found.flatMap(({ actions: names }) => names.map((name) => `\`${name}\``)))];
      return [
        {
          ruleId: "iam-privilege-escalation",
          title: "IAM policy allows privilege escalation",
          severity: "high" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "allow" : "allows"} ${listOf(actions)} on every resource with no condition, so whoever holds this policy, or takes over what runs with it, can attach an administrator policy, create keys for other users, or pass and assume a more powerful role, and make themselves an administrator of the account.`,
          recommendation:
            "Name the roles, users, and policies the statement may touch in `Resource`, and limit it with conditions, such as `iam:PassedToService` for `iam:PassRole` or `iam:PermissionsBoundary` for policy changes. Give administrative IAM permissions to a separate, tightly held role."
        }
      ];
    });
  }
};
