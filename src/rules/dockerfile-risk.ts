import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "unpinned-base" | "root-user" | "remote-add" | "secret-variable";

// In the order the message lists them, which follows a Dockerfile from top to bottom.
const labels: Record<Kind, string> = {
  "unpinned-base": "a base image without a version tag or with `latest`",
  "remote-add": "a file downloaded by `ADD` without a checksum",
  "secret-variable": "a secret in `ENV` or `ARG`, which the image and its history keep",
  "root-user": "a final `USER` that runs the image as root"
};

// `Dockerfile`, `Dockerfile.dev`, `api.Dockerfile`, and the same for Podman's `Containerfile`.
const dockerfile = /(?:^|\/)(?:(?:Dockerfile|Containerfile)(?:\.[\w.-]{1,100})?|[\w.-]{1,100}\.(?:dockerfile|containerfile))$/i;
const instruction = /^\s*([A-Za-z]{2,11})\s+(.*)$/;
const commentLine = /^\s*#/;
// Words in a variable name that mark it as holding a secret, as in Docker's SecretsUsedInArgOrEnv
// check. A name that ends in a word for where the secret lives, such as `TOKEN_FILE`, is a path.
const secretWords = new Set(["password", "passwd", "secret", "token", "apikey", "credential", "credentials"]);
const secretPairs = [
  ["api", "key"],
  ["private", "key"],
  ["access", "key"],
  ["secret", "key"]
];
const locationWords = new Set(["file", "path", "dir", "url", "uri", "endpoint", "host", "name", "id", "type", "header"]);

export const dockerfileRiskRule: Rule = {
  id: "dockerfile-risk",
  description: "Flags unpinned base images, root users, unchecked downloads, and secrets in Dockerfiles.",
  run({ files, config }) {
    if (!config.rules.dockerfileRisk.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !dockerfile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findRisks(file.patch);
      if (found.length === 0) {
        return [];
      }

      const listed = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(found.map((match) => match.line));
      return [
        {
          ruleId: "dockerfile-risk",
          title: "Risky Dockerfile change",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: [...new Set(found.map((match) => match.line))],
          message: `${text} ${plural ? "add" : "adds"} ${joinLabels(listed.map((kind) => labels[kind]))}.`,
          recommendation:
            "Pin base images to a version or digest, switch to a non-root USER before the image runs, give remote ADD sources a --checksum, and pass secrets with RUN --mount=type=secret, since ENV values and build arguments stay in the image and its history."
        }
      ];
    });
  }
};

type Instruction = { keyword: string; args: string; line: number; added: boolean };

function findRisks(patch: string): Array<{ line: number; kind: Kind }> {
  const instructions = readInstructions(patch);
  const stages = new Set<string>();
  const found: Array<{ line: number; kind: Kind }> = [];

  for (const [index, { keyword, args, line, added }] of instructions.entries()) {
    if (keyword === "FROM") {
      const [image = "", ...rest] = args.replace(/--[\w-]{1,50}=\S{1,200}\s*/g, "").trim().split(/\s+/);
      const stage = /^as$/i.test(rest[0] ?? "") ? rest[1]?.toLowerCase() : undefined;
      if (added && isUnpinned(image, stages)) {
        found.push({ line, kind: "unpinned-base" });
      }
      if (stage !== undefined) {
        stages.add(stage);
      }
    }
    // Only the last USER the diff shows decides who the image runs as.
    if (keyword === "USER" && added && isRoot(args) && !instructions.slice(index + 1).some((later) => later.keyword === "USER")) {
      found.push({ line, kind: "root-user" });
    }
    if (keyword === "ADD" && added && /(?:^|\s)https?:\/\//i.test(args) && !/--checksum=/i.test(args)) {
      found.push({ line, kind: "remote-add" });
    }
    if ((keyword === "ENV" || keyword === "ARG") && added && variableNames(keyword, args).some(isSecretName)) {
      found.push({ line, kind: "secret-variable" });
    }
  }

  return found;
}

// Instructions in the lines the patch shows, with lines continued by a trailing `\` read as one.
// Comment lines are skipped, also inside a continued instruction, as Docker does.
function readInstructions(patch: string): Instruction[] {
  const instructions: Instruction[] = [];
  let current: Instruction | undefined;

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      current = undefined;
    }
    if (commentLine.test(content)) {
      continue;
    }

    const continues = /\\\s*$/.test(content);
    const text = content.replace(/\\\s*$/, "");
    if (current !== undefined) {
      current.args = `${current.args} ${text.trim()}`;
      current.added ||= added;
    } else {
      const match = instruction.exec(text);
      // A hunk can start inside a continued instruction; those lines are not read.
      if (match === null) {
        continue;
      }
      current = { keyword: (match[1] ?? "").toUpperCase(), args: (match[2] ?? "").trim(), line, added };
      instructions.push(current);
    }
    if (!continues) {
      current = undefined;
    }
  }

  return instructions;
}

function isUnpinned(image: string, stages: ReadonlySet<string>): boolean {
  const name = image.toLowerCase();
  // A variable is set elsewhere, `scratch` is empty, and a stage is built in the same file.
  if (name === "" || name.includes("$") || name === "scratch" || stages.has(name) || name.includes("@sha256:")) {
    return false;
  }
  // A registry port, as in `registry:5000/app`, is not a tag; only the last segment has one.
  const lastSegment = name.slice(name.lastIndexOf("/") + 1);
  const tag = lastSegment.includes(":") ? lastSegment.slice(lastSegment.indexOf(":") + 1) : "";
  return tag === "" || tag === "latest";
}

function isRoot(args: string): boolean {
  const user = args.trim().split(/[\s:]/)[0] ?? "";
  return user === "root" || user === "0";
}

// `ENV A=1 B=2`, the legacy `ENV A 1`, `ARG A`, and `ARG A=1 B`. Quoted values are removed first,
// so words inside them are not read as names.
function variableNames(keyword: string, args: string): string[] {
  if (keyword === "ENV" && !/^[\w.-]{1,200}=/.test(args)) {
    return [args.split(/\s/)[0] ?? ""];
  }
  const unquoted = args.replace(/"(?:[^"\\]|\\.){0,2000}"|'[^']{0,2000}'/g, "''");
  const name = keyword === "ENV" ? /(?:^|\s)([A-Za-z_][\w.-]{0,199})(?==)/g : /(?:^|\s)([A-Za-z_][\w.-]{0,199})(?==|\s|$)/g;
  return [...unquoted.matchAll(name)].map((match) => match[1] ?? "");
}

function isSecretName(name: string): boolean {
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_.-]+/)
    .filter((word) => word !== "");
  if (words.length === 0 || locationWords.has(words[words.length - 1] ?? "") || words.includes("public")) {
    return false;
  }

  return (
    words.some((word) => secretWords.has(word)) ||
    secretPairs.some(([first, second]) => words.some((word, index) => word === first && words[index + 1] === second))
  );
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}
