import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines } from "./line-list.js";

// A principal of everyone: JSON and YAML policies' `"Principal": "*"` and `{"AWS": "*"}`,
// Terraform's `principals { identifiers = ["*"] }`, `aws_lambda_permission`'s `principal = "*"`, and
// the CDK's AnyPrincipal and StarPrincipal.
// The key starts the line or follows `{` or `,`, so a description that quotes a policy is not one.
const jsonPrincipal = /(?:^\s*-?\s*|[{,]\s*)["']?Principal["']?\s*:\s*(?:["']\*["']|\{\s*["']?AWS["']?\s*:\s*\[?\s*["']\*["'])|^\s*-?\s*["']?Principal["']?\s*:\s*\*\s*$/;
// `Principal:` or `"Principal": {` with `AWS: "*"` on the next line.
const yamlAwsPrincipal = /^\s*["']?AWS["']?\s*:\s*\[?\s*["']?\*["']?\s*\]?\s*,?\s*$/;
const yamlPrincipalKey = /^\s*-?\s*["']?Principal["']?\s*:\s*\{?\s*$/;
const terraformIdentifiers = /^\s*identifiers\s*=\s*\[\s*"\*"\s*\]/;
const terraformPrincipals = /^\s*principals\s*\{/;
const lambdaPrincipal = /^\s*principal\s*=\s*"\*"/;
const cdkPrincipal = /\bnew\s+(?:iam\.)?(?:AnyPrincipal|StarPrincipal)\s*\(|\biam\.(?:AnyPrincipal|StarPrincipal)\s*\(/;

// Statements that only deny, such as one that requires TLS, and statements limited by a condition,
// such as an organization, a VPC, or a source account or ARN. Permissions for a Lambda function URL
// are left to `unauthenticated-function`.
const deny = /["']?Effect["']?\s*[:=]\s*["']?Deny\b|\beffect\s*=\s*"Deny"|\beffect\s*:\s*(?:iam\.)?Effect\.DENY\b/i;
const condition = /["']?Condition["']?\s*:|^\s*condition\s*\{|\bconditions\s*:|\bsource_(?:arn|account)\s*=|\bprincipal_org_id\s*=|\bSource(?:Arn|Account)["']?\s*:|\bFunctionUrlAuthType\b|\bfunction_url_auth_type\b/m;
// Every action, a service's every action such as `s3:*`, and actions that change data or run code.
const writeAction =
  /\bactions?["']?\s*[:=]\s*\[?\s*["']\*["']|\b[a-z0-9-]+:\*|\b(?:s3|sqs|sns|kms|lambda|secretsmanager|ecr|dynamodb|es|logs|events|glacier|elasticfilesystem):(?:Put|Delete|Send|Publish|Decrypt|Encrypt|GenerateDataKey|Invoke|Create|Update|Write|Restore|Batch|ReEncrypt|Subscribe|Purge|Change|Set|Abort|Replicate)\w*|\bGetSecretValue\b|\blambda:InvokeFunction\b/;
const statementWindow = 25;

const policyFile = /\.(?:json|ya?ml|template|tf|tf\.json|hcl|[cm]?[jt]s|py|java|go|cs)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ|snapshots?|__snapshots__)(?:[\/_.-]|$)|\.snap$|(?:^|\/)(?:hack|docs?)\//i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$|\.schema\.json$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const describesValues = /\b(?:description|help)\s*[:=]/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 2_000;

export const publicResourcePolicyRule: Rule = {
  id: "public-resource-policy",
  description: "Flags AWS resource policies that allow every principal, such as `\"Principal\": \"*\"`, with no condition.",
  run({ files, config }) {
    if (!config.rules.publicResourcePolicy.enabled) {
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
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; writes: boolean }> = [];
      // Python docstrings hold examples, as the CDK's and Ansible modules' do.
      let inDocstring = false;
      lines.forEach(({ line, content, added, startsHunk }, index) => {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|\'\'\'/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (wasInDocstring || !added || content.length > maxLineLength || commentLine.test(content) || describesValues.test(content)) {
          return;
        }
        const everyone =
          jsonPrincipal.test(content) ||
          cdkPrincipal.test(content) ||
          lambdaPrincipal.test(content) ||
          (yamlAwsPrincipal.test(content) && yamlPrincipalKey.test(contents[index - 1] ?? "")) ||
          (terraformIdentifiers.test(content) && contents.slice(Math.max(0, index - 3), index).some((other) => terraformPrincipals.test(other)));
        if (!everyone) {
          return;
        }
        const statement = statementAround(contents, index);
        if (deny.test(statement) || condition.test(statement)) {
          return;
        }
        found.push({ line, writes: writeAction.test(statement) });
      });
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = found.map(({ line }) => line);
      const { text, plural } = describeLines(lineNumbers);
      const writes = found.some(({ writes: write }) => write);
      return [
        {
          ruleId: "public-resource-policy",
          title: "Resource policy open to everyone",
          severity: writes ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${text} ${plural ? "allow" : "allows"} every principal, including anonymous callers and every other AWS account, with no condition, so anyone who learns the resource's name can ${writes ? "change it, read its private data, or run it" : "read it"}.`,
          recommendation:
            "Name the accounts, roles, or services that need access, or add a condition that limits the statement, such as `aws:PrincipalOrgID`, `aws:SourceVpce`, `aws:SourceArn`, or `aws:SourceAccount`. Serve public files through CloudFront with origin access control instead of a public bucket policy."
        }
      ];
    });
  }
};

// The text of the policy statement the line is in: up to the nearest statement start before it and
// the next one after it, within a window.
function statementAround(contents: string[], index: number): string {
  const start = /^\s*-\s*["']?(?:Sid|Effect|Action|Principal|Resource)["']?\s*:|^\s*statement\s*\{|["']Sid["']\s*:|\bnew\s+(?:iam\.)?PolicyStatement\s*\(|^\s*\{\s*$|^\s*(?:resource|data|module)\s+"/;
  let first = index;
  for (let before = index - 1; before >= Math.max(0, index - statementWindow); before -= 1) {
    first = before;
    if (start.test(contents[before] ?? "")) {
      break;
    }
  }
  let last = index;
  for (let after = index + 1; after < Math.min(contents.length, index + statementWindow); after += 1) {
    if (start.test(contents[after] ?? "")) {
      break;
    }
    last = after;
  }
  return contents.slice(first, last + 1).join("\n");
}
