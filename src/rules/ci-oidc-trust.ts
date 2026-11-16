import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Issuer = { host: string; who: string; mention: RegExp; key: RegExp };
type Trust = { line: number; statement: number; issuer: Issuer; values: string[] };

// CI services whose OIDC tokens all come from one issuer, so a role that trusts the issuer without
// naming an owner trusts every customer of the service. GitHub Enterprise issuers with a path, and
// per-organization issuers such as CircleCI's, are left out.
const issuers: Issuer[] = [
  ["token.actions.githubusercontent.com", "any GitHub repository"],
  ["gitlab.com", "any GitLab.com project"],
  ["app.terraform.io", "any HCP Terraform workspace"],
  ["agent.buildkite.com", "any Buildkite pipeline"]
].map(([host = "", who = ""]) => {
  const escaped = host.replace(/\./g, "\\.");
  return { host, who, mention: new RegExp(`(?<![\\w.-])${escaped}(?![\\w.\\/-])`), key: new RegExp(`(?<![\\w.-])${escaped}:(\\w+)`, "g") };
});

// Statements that let a token from an identity provider assume a role.
const webIdentity = /\bAssumeRoleWithWebIdentity\b|\b(?:WebIdentityPrincipal|OpenIdConnectPrincipal)\s*\(/;
// Claims that say nothing about whose repository or project the token comes from: anyone can run a
// pipeline on a branch named `main`, in an environment named `production`, or as themselves.
const notOwnerClaim =
  /^(?:aud|amr|azp|iss|ref|ref_type|ref_protected|ref_path|environment|environment_protected|deployment_tier|event_name|actor|actor_id|workflow|runner_environment|base_ref|head_ref|user_login|user_id|user_email|run_phase|pipeline_source|sha|build_branch|build_tag|build_commit)$/;
// Any claim that could name the owner, written with an issuer this rule does not know, such as
// `"${var.oidc_host}:sub"`.
const otherSubjectKey = /[^\s"'=]:(?:sub|repository|repository_owner|job_workflow_ref|project_path|namespace_path|terraform_organization_name|organization_slug)\b/;
// Conditions built elsewhere, which the diff does not show.
const computedConditions = /\bdynamic\s+"condition"|\bfor_each\b|\.\.\.[\w.]|\*\*\w|["']?\bconditions?["']?\s*[:=]\s*(?![\s{[]|$)/i;
const operator = /\b(?:ForA(?:ny|ll)Values?:)?String(Equals|Like)(?:IgnoreCase)?\b/g;

// Where a statement starts: a YAML list item, a Terraform `statement` block, a CDK statement, or a
// JSON object on a line of its own.
const statementStart =
  /^\s*-\s*["']?(?:Sid|Effect|Action|Principal|Condition)["']?\s*:|^\s*statement\s*\{|\b(?:new\s+)?(?:iam\.)?(?:PolicyStatement|WebIdentityPrincipal|OpenIdConnectPrincipal|FederatedPrincipal)\s*\(|^\s*\{\s*$|["']?Statement["']?\s*[:=]\s*\[\s*\{\s*$|^\s*(?:resource|data)\s+"/;
const maxBefore = 30;
const maxStatement = 60;
const maxConditionLines = 8;

const policyFile = /\.(?:json|ya?ml|template|tf|tf\.json|hcl|[cm]?[jt]s|py|go|cs|java)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$|\.schema\.json$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ)(?:[\/_.-]|$)|__snapshots__|\.snap$|(?:^|\/)(?:hack|docs?)\//i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;

// Code with quoted text removed, so brackets inside strings do not count.
function bracketDepth(content: string): number {
  const code = content.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`/g, "").replace(/\s#.*$|\/\/.*$/, "");
  return (code.match(/[{[(]/g)?.length ?? 0) - (code.match(/[}\])]/g)?.length ?? 0);
}

function indentOf(content: string): number {
  return /^\s*/.exec(content)?.[0].length ?? 0;
}

// The lines of the statement around `index`, and whether all of it is in the diff, so a missing
// condition is really missing rather than outside the hunk.
function statementAt(lines: PatchLine[], index: number, wholeFile: boolean): { first: number; last: number; complete: boolean } {
  let first = -1;
  for (let before = index; before >= Math.max(0, index - maxBefore); before -= 1) {
    const line = lines[before];
    if (line === undefined) {
      break;
    }
    if (statementStart.test(line.content)) {
      first = before;
      break;
    }
    if (line.startsHunk) {
      break;
    }
  }
  if (first < 0) {
    return { first: Math.max(0, index - maxBefore), last: Math.min(lines.length - 1, index + maxStatement), complete: false };
  }

  const start = lines[first]?.content ?? "";
  const yamlItem = /^\s*-\s/.test(start);
  let depth = 0;
  let opened = false;
  for (let position = first; position < lines.length && position < first + maxStatement; position += 1) {
    const line = lines[position];
    if (line === undefined || (position > first && line.startsHunk)) {
      break;
    }
    if (yamlItem) {
      const next = lines[position + 1];
      if (next === undefined) {
        return { first, last: position, complete: wholeFile };
      }
      if (next.startsHunk) {
        break;
      }
      if (next.content.trim() !== "" && indentOf(next.content) <= indentOf(start)) {
        return { first, last: position, complete: true };
      }
      continue;
    }
    depth += bracketDepth(line.content);
    opened ||= depth > 0;
    if (opened && depth <= 0) {
      return { first, last: position, complete: true };
    }
  }
  return { first, last: Math.min(lines.length - 1, first + maxStatement - 1), complete: false };
}

// The quoted or YAML values given to the condition key at the end of `rest`, reading on through a
// list that spans several lines.
function valuesFrom(lines: PatchLine[], index: number, rest: string, last: number): { values: string[]; lines: number[] } {
  const values: string[] = [];
  const numbers: number[] = [];
  const take = (text: string, line: number) => {
    for (const [, double, single, template] of text.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)) {
      values.push(double ?? single ?? template ?? "");
      numbers.push(line);
    }
  };

  const text = rest.replace(/^["']?\s*[:=]?\s*/, "");
  const position = index;
  const line = lines[position]?.line ?? 0;
  if (/^[^"'`[\s{(]/.test(text)) {
    // A plain YAML value, such as `repo:octo-org/*` or `!Sub repo:${Org}/*`.
    values.push(text.replace(/^!Sub\s+/, "").replace(/\s+#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2"));
    numbers.push(line);
    return { values, lines: numbers };
  }
  take(text, line);
  if (text.trim() === "" || (text.includes("[") && !text.includes("]"))) {
    const indent = indentOf(lines[position]?.content ?? "");
    for (let next = position + 1; next <= last; next += 1) {
      const content = lines[next]?.content ?? "";
      const item = /^\s*-\s+(.*)$/.exec(content);
      if (item !== null && indentOf(content) >= indent) {
        const value = (item[1] ?? "").replace(/\s+#.*$/, "").trim();
        values.push(value.replace(/^(["'])(.*)\1$/, "$2"));
        numbers.push(lines[next]?.line ?? 0);
        continue;
      }
      if (text.includes("[")) {
        take(content.split("]")[0] ?? "", lines[next]?.line ?? 0);
        if (content.includes("]")) {
          break;
        }
        continue;
      }
      break;
    }
  }
  return { values, lines: numbers };
}

// Terraform's `condition` block around a `variable = "...:sub"` line: whether its `test` matches
// wildcards, and the line with its `values`, in whatever order the block lists them.
function conditionBlock(lines: PatchLine[], index: number, first: number, last: number): { likes: boolean; values: number } {
  let start = index;
  while (start > first && index - start < maxConditionLines && !/^\s*condition\s*\{/.test(lines[start]?.content ?? "")) {
    start -= 1;
  }
  let end = index;
  while (end < last && end - index < maxConditionLines && !/^\s*\}/.test(lines[end]?.content ?? "")) {
    end += 1;
  }
  const block = lines.slice(start, end + 1);
  const test = /\btest\s*=\s*"([^"]+)"/.exec(block.map(({ content }) => content).join("\n"))?.[1];
  const values = block.findIndex(({ content }) => /^\s*values\s*=/.test(content));
  return { likes: test === undefined || /Like/.test(test), values: values < 0 ? -1 : start + values };
}

// Whether a subject or owner claim value matches every owner: `*`, `repo:*`, or a wildcard in the
// owner's name, such as `repo:octo-org*`, which anyone can match by naming their own account that way.
function anyOwner(value: string): boolean {
  const owner = value.replace(/^(?:repo|project_path|organization):/, "").split(/[\/:]/)[0] ?? "";
  return owner === "" || /[*?]/.test(owner);
}

function trustsEveryOwner(lines: PatchLine[], first: number, last: number, complete: boolean): Trust[] {
  const statement = lines.slice(first, last + 1);
  if (!statement.some(({ added }) => added) || statement.some(({ content }) => computedConditions.test(content))) {
    return [];
  }
  const text = statement.map(({ content }) => content).join("\n");
  const found: Trust[] = [];
  for (const issuer of issuers) {
    if (!issuer.mention.test(text)) {
      continue;
    }
    const ownerKeys: Array<{ index: number; rest: string; likes: boolean }> = [];
    let likes = true;
    statement.forEach(({ content }, offset) => {
      if (commentLine.test(content)) {
        return;
      }
      for (const [, kind] of content.matchAll(operator)) {
        likes = kind === "Like";
      }
      for (const match of content.matchAll(issuer.key)) {
        if (!notOwnerClaim.test(match[1] ?? "")) {
          ownerKeys.push({ index: first + offset, rest: content.slice((match.index ?? 0) + match[0].length), likes });
        }
      }
    });

    if (ownerKeys.length === 0) {
      // No condition on whose repository or project the token comes from.
      const anchor = statement.find(({ added, content }) => added && (webIdentity.test(content) || issuer.mention.test(content)));
      if (complete && !otherSubjectKey.test(text) && anchor !== undefined) {
        found.push({ line: anchor.line, statement: first, issuer, values: [] });
      }
      continue;
    }
    for (const key of ownerKeys) {
      let { index, rest, likes: wildcards } = key;
      if (/^\s*variable\s*=/.test(lines[index]?.content ?? "")) {
        const block = conditionBlock(lines, index, first, last);
        if (block.values < 0) {
          continue;
        }
        wildcards = block.likes;
        index = block.values;
        rest = (lines[index]?.content ?? "").replace(/^\s*values\s*/, "");
      }
      const { values, lines: numbers } = valuesFrom(lines, index, rest, last);
      values.forEach((value, position) => {
        const line = lines.find(({ line: number }) => number === numbers[position]);
        if (wildcards && anyOwner(value) && line?.added === true) {
          found.push({ line: line.line, statement: first, issuer, values: [value] });
        }
      });
    }
  }
  return found;
}

function oidcTrusts(lines: PatchLine[], wholeFile: boolean): Trust[] {
  const seen = new Set<number>();
  const found: Trust[] = [];
  lines.forEach(({ content }, index) => {
    if (!webIdentity.test(content) || commentLine.test(content)) {
      return;
    }
    const { first, last, complete } = statementAt(lines, index, wholeFile);
    if (seen.has(first)) {
      return;
    }
    seen.add(first);
    found.push(...trustsEveryOwner(lines, first, last, complete));
  });
  return found;
}

export const ciOidcTrustRule: Rule = {
  id: "ci-oidc-trust",
  description:
    "Flags AWS role trust policies that accept OIDC tokens from GitHub Actions, GitLab.com, HCP Terraform, or Buildkite without naming the repository or project, so any of their users can assume the role.",
  run({ files, config }) {
    if (!config.rules.ciOidcTrust.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !policyFile.test(file.path) ||
        file.patch === undefined ||
        skippedFile.test(file.path) ||
        ciOrTestSetup.test(file.path) ||
        // Development, example, and test stacks.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = oidcTrusts(patchLines(file.patch), file.status === "added");
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))];
      const { text, plural } = describeLines(lineNumbers);
      const who = [...new Set(found.map(({ issuer }) => issuer.who))];
      const wildcards = [...new Set(found.flatMap(({ values }) => values.map((value) => `\`${value}\``)))];
      const roles = new Set(found.map(({ statement }) => statement)).size > 1;
      const reasons = [
        ...(found.some(({ values }) => values.length === 0) ? [`${roles ? "check" : "checks"} only the token's audience or branch, not whose repository or project it comes from`] : []),
        ...(wildcards.length > 0 ? [`${roles ? "match" : "matches"} the ${wildcards.length > 1 ? "subjects" : "subject"} ${listOf(wildcards)}, which ${wildcards.length > 1 ? "allow" : "allows"} every owner`] : [])
      ];
      return [
        {
          ruleId: "ci-oidc-trust",
          title: "Cloud role trusts every CI pipeline",
          severity: "high" as const,
          file: file.path,
          line: Math.min(...lineNumbers),
          lines: lineNumbers,
          message: `${text} ${plural ? "let" : "lets"} ${listOf(who)} assume ${roles ? "these roles" : "this role"}, because ${roles ? "their trust policies" : "the trust policy"} ${listOf(reasons)}. Anyone can get such a token by running a pipeline in an account of their own, and then act with the ${roles ? "roles'" : "role's"} permissions in this cloud account.`,
          recommendation:
            "Add a condition on the token's `sub` that names your own organization and repository, such as `\"token.actions.githubusercontent.com:sub\": \"repo:my-org/my-repo:ref:refs/heads/main\"` with `StringEquals`, or `repo:my-org/my-repo:*` with `StringLike`, and keep the `aud` check. On GitLab.com use `project_path:my-group/my-project:ref_type:branch:ref:main`, on HCP Terraform `organization:my-org:project:my-project:workspace:my-workspace:run_phase:*`, and on Buildkite `organization:my-org:pipeline:my-pipeline:*`. Keep wildcards out of the owner's name."
        }
      ];
    });
  }
};
