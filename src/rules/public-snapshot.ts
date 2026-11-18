import { minimatch } from "minimatch";
import { patchLines, type PatchLine } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Kind = "image" | "snapshot" | "database" | "gallery";
type Share = { line: number; kind: Kind };

const sharingFile =
  /\.(?:tf|tf\.json|hcl|json|ya?ml|template|sh|bash|zsh|ps1|psm1|py|rb|go|[cm]?[jt]s|java|kt|cs|bicep)$|(?:^|\/)(?:Makefile|Jenkinsfile|Dockerfile)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$|(?:^|\/)package(?:-lock)?\.json$|\.schema\.json$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const ciOrTestSetup = /(?:^|[\/_.-])(?:e2e|integ)(?:[\/_.-]|$)|__snapshots__|\.snap$|(?:^|\/)(?:hack|docs?)\//i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--|REM\b|::)/i;
const contextWindow = 8;
const commandLines = 15;

const all = String.raw`["']all["']`;
// Lists that share with every account: Packer's `ami_groups` and `snapshot_groups`, Terraform's
// `shared_accounts` on RDS snapshots, and EC2 Image Builder's `user_groups` and `UserGroups`.
const settings: Array<{ kind: Kind; pattern: RegExp }> = [
  { kind: "image", pattern: new RegExp(String.raw`\bami_groups["']?\s*[:=]\s*\[[^\]]*${all}`) },
  { kind: "snapshot", pattern: new RegExp(String.raw`\bsnapshot_groups["']?\s*[:=]\s*\[[^\]]*${all}`) },
  { kind: "database", pattern: new RegExp(String.raw`\bshared_accounts["']?\s*[:=]\s*\[[^\]]*${all}`) },
  { kind: "image", pattern: /\b(?:user_groups|UserGroups)["']?\s*[:=]\s*\[[^\]]*["']?\ball\b["']?\s*[,\]]/ }
];
// `{ Group: "all" }` and `GroupNames=["all"]` in an SDK call, with the attribute it changes nearby.
const sdkGroup = /["']?\bGroup["']?\s*[:=]\s*(?:aws\.String\(\s*)?["']all["']/;
const sdkGroupNames = new RegExp(String.raw`\bGroupNames["']?\s*[:=]\s*(?:\[\]\*?string\s*\{|\[)[^\]}]*(?:aws\.String\(\s*)?${all}`);
const sdkValuesToAdd = new RegExp(String.raw`\bValuesToAdd["']?\s*[:=]\s*(?:\[\]\*?string\s*\{|\[)[^\]}]*(?:aws\.String\(\s*)?${all}`);
const imageContext = /LaunchPermission|launch_permission|modify_image_attribute|ModifyImageAttribute/;
const snapshotContext = /CreateVolumePermission|create_volume_permission|createVolumePermission|modify_snapshot_attribute|ModifySnapshotAttribute/;
const operation = /\b(Add|Remove|ValuesToRemove)\b["']?\s*[:=]/g;
// Terraform's `aws_ami_launch_permission` with `group = "all"`.
const launchPermissionGroup = /^\s*group\s*=\s*"all"/;
const launchPermissionResource = /\bresource\s+"aws_ami_launch_permission"/;
// A YAML list item `- all` under `UserGroups:`.
const userGroupsKey = /^\s*["']?(?:UserGroups|user_groups|ami_groups|snapshot_groups|shared_accounts)["']?\s*:\s*$/;
const allItem = /^\s*-\s*["']?all["']?\s*$/;
// Azure Compute Galleries shared with the community, which any Azure customer can use.
const communityGallery = /\bpermission\s*=\s*"Community"|["']?\bpermissions["']?\s*:\s*["']Community["']|\baz\s+sig\s+share\s+enable-community\b/;
const galleryContext = /\bsharing\s*\{|sharingProfile|\baz\s+sig\b/;

// AWS CLI and PowerShell commands that share an image or snapshot with every account.
const commands: Array<{ kind: Kind; command: RegExp; shares: RegExp }> = [
  {
    kind: "image",
    command: /\bmodify-image-attribute\b|\bEdit-EC2ImageAttribute\b/i,
    shares: /Add=\[?\{?Group=all\b|"Add"\s*:\s*\[\s*\{\s*"Group"\s*:\s*"all"|--user-groups\s+["']?all\b|-UserGroup\s+["']?all\b/i
  },
  {
    kind: "snapshot",
    command: /\bmodify-snapshot-attribute\b|\bEdit-EC2SnapshotAttribute\b/i,
    shares: /Add=\[?\{?Group=all\b|"Add"\s*:\s*\[\s*\{\s*"Group"\s*:\s*"all"|--group-names\s+["']?all\b|-GroupName\s+["']?all\b/i
  },
  {
    kind: "database",
    command: /\bmodify-db-(?:cluster-)?snapshot-attribute\b|\bEdit-RDSDB(?:Cluster)?SnapshotAttribute\b/i,
    shares: /--values-to-add\s+(?:["'[\s]*)?all\b|-ValuesToAdd\s+["']?all\b/i
  }
];
const removeOperation = /--operation-type\s+["']?remove\b|-OperationType\s+["']?remove\b/i;

// Whether the nearest `Add` or `Remove` key at or before the line removes the share.
function removes(lines: PatchLine[], index: number): boolean {
  for (let before = index; before >= Math.max(0, index - 4); before -= 1) {
    const keys = [...(lines[before]?.content ?? "").matchAll(operation)];
    const last = keys.at(-1)?.[1];
    if (last !== undefined) {
      return last !== "Add";
    }
  }
  return false;
}

function near(lines: PatchLine[], index: number): string {
  return lines
    .slice(Math.max(0, index - contextWindow), index + contextWindow + 1)
    .map(({ content }) => content)
    .join("\n");
}

// A command and the lines it continues onto with `\`, a PowerShell backtick, or `^`.
function commandText(lines: PatchLine[], index: number): { text: string; changed: boolean } {
  const span: PatchLine[] = [];
  for (let position = index; position < lines.length && position < index + commandLines; position += 1) {
    const line = lines[position];
    if (line === undefined || (position > index && line.startsHunk)) {
      break;
    }
    span.push(line);
    if (!/[\\`^]\s*$/.test(line.content)) {
      break;
    }
  }
  return { text: span.map(({ content }) => content.replace(/[\\`^]\s*$/, "")).join(" "), changed: span.some(({ added }) => added) };
}

function shares(lines: PatchLine[]): Share[] {
  const found: Share[] = [];
  let previous = "";
  lines.forEach(({ line, content, added, startsHunk }, index) => {
    const after = startsHunk ? "" : previous;
    if (content.trim() !== "") {
      previous = content;
    }
    if (commentLine.test(content)) {
      return;
    }

    for (const { kind, command, shares: pattern } of commands) {
      if (command.test(content)) {
        const { text, changed } = commandText(lines, index);
        if (changed && pattern.test(text) && !removeOperation.test(text)) {
          found.push({ line, kind });
        }
      }
    }
    if (!added) {
      return;
    }
    for (const { kind, pattern } of settings) {
      if (pattern.test(content)) {
        found.push({ line, kind });
      }
    }
    if (allItem.test(content) && userGroupsKey.test(after)) {
      const key = /ami_groups|UserGroups|user_groups/.test(after) ? "image" : /snapshot_groups/.test(after) ? "snapshot" : "database";
      found.push({ line, kind: key });
    }
    if (launchPermissionGroup.test(content) && lines.slice(Math.max(0, index - contextWindow), index).some(({ content: before }) => launchPermissionResource.test(before))) {
      found.push({ line, kind: "image" });
    }
    const context = sdkGroup.test(content) || sdkGroupNames.test(content) || sdkValuesToAdd.test(content) ? near(lines, index) : "";
    if (context !== "" && !removes(lines, index)) {
      if (sdkValuesToAdd.test(content)) {
        found.push({ line, kind: "database" });
      } else if (snapshotContext.test(context)) {
        found.push({ line, kind: "snapshot" });
      } else if (imageContext.test(context) && sdkGroup.test(content)) {
        found.push({ line, kind: "image" });
      }
    }
    if (communityGallery.test(content) && galleryContext.test(near(lines, index))) {
      found.push({ line, kind: "gallery" });
    }
  });
  return found;
}

const phrases: Record<Kind, string> = {
  image: "makes a machine image public, so any AWS account can launch it and read the files, keys, and credentials built into it",
  snapshot: "shares an EBS snapshot with every AWS account, so anyone can create a volume from it and read the disk",
  database: "shares a database snapshot with every AWS account, so anyone can restore it and read the data",
  gallery: "shares an Azure Compute Gallery with the community, so any Azure customer can create machines from its images"
};

export const publicSnapshotRule: Rule = {
  id: "public-snapshot",
  description:
    "Flags machine images, EBS snapshots, and RDS snapshots shared with every AWS account, and Azure Compute Galleries shared with the community, in Terraform, Packer, CloudFormation, the AWS CLI, PowerShell, and SDK calls.",
  run({ files, config }) {
    if (!config.rules.publicSnapshot.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        !sharingFile.test(file.path) ||
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

      const found = shares(patchLines(file.patch));
      if (found.length === 0) {
        return [];
      }

      const lineNumbers = [...new Set(found.map(({ line }) => line))];
      const { text } = describeLines(lineNumbers);
      const kinds = (Object.keys(phrases) as Kind[]).filter((kind) => found.some((share) => share.kind === kind));
      // A snapshot shared next to a public image is usually that image's own disk, which publishers
      // of operating system images share with it.
      const high = kinds.includes("database") || (kinds.includes("snapshot") && !kinds.includes("image"));
      return [
        {
          ruleId: "public-snapshot",
          title: "Image or snapshot shared with everyone",
          severity: high ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...lineNumbers),
          lines: lineNumbers,
          message: `In ${text.charAt(0).toLowerCase()}${text.slice(1)}, the change ${listOf(kinds.map((kind) => phrases[kind]))}.`,
          recommendation:
            "Share images and snapshots only with the accounts that need them, by account ID, organization, or organizational unit. If an image is meant to be public, such as an operating system or product image, build it in a clean pipeline, check it for keys and credentials before sharing, and turn on block public access for AMIs and EBS snapshots in the accounts that should never share publicly."
        }
      ];
    });
  }
};
