import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { developmentPath } from "./insecure-web-config.js";
import { describeLines, listOf } from "./line-list.js";

type Setting = { label: string; files: RegExp; pattern: RegExp; context?: RegExp };

const code = /\.(?:[cm]?[jt]sx?|py|java|kt|cs|go)$/i;
const commandFile = /\.(?:sh|bash|zsh|ps1|ya?ml|mk)$|(?:^|\/)(?:Makefile|Jenkinsfile[^/]*|Dockerfile[^/]*)$/i;

const settings: Setting[] = [
  // AWS Lambda function URLs that anyone can call.
  { label: "an AWS Lambda function URL", files: /\.tf$/i, pattern: /\bauthorization_type\s*=\s*"NONE"/, context: /\baws_lambda_function_url\b/ },
  { label: "an AWS Lambda function URL", files: /\.(?:ya?ml|json|template)$/i, pattern: /["']?AuthType["']?\s*:\s*["']?NONE\b/ },
  { label: "an AWS Lambda function URL", files: code, pattern: /\bFunctionUrlAuthType(?:\.|_)NONE\b/ },
  // The Serverless Framework's `url: true`, which has no authorizer.
  { label: "an AWS Lambda function URL", files: /(?:^|\/)serverless\.ya?ml$/i, pattern: /^\s*url\s*:\s*true\s*$/ },
  // Cloud Run services and Cloud Functions deployed for anyone to call.
  { label: "a Google Cloud Run service or Cloud Function", files: commandFile, pattern: /(?<!no-)--allow-unauthenticated\b/, context: /\bgcloud\b|google-github-actions\/deploy-cloud(?:run|functions)/ },
  // Azure Functions with HTTP triggers anyone can call.
  { label: "an Azure Function", files: /(?:^|\/)function\.json$/i, pattern: /["']authLevel["']\s*:\s*["']anonymous["']/i },
  { label: "an Azure Function", files: /\.py$/i, pattern: /\bauth_level\s*=\s*(?:func\.)?AuthLevel\.ANONYMOUS\b/ },
  { label: "an Azure Function", files: /\.(?:[cm]?[jt]sx?)$/i, pattern: /\bauthLevel\s*:\s*["']anonymous["']/, context: /@azure\/functions|azure-functions/ },
  { label: "an Azure Function", files: /\.(?:cs|java|kt)$/i, pattern: /\bAuthorizationLevel\.(?:Anonymous|ANONYMOUS)\b/ }
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*)/;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$|\.map$/i;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;
const maxLineLength = 1_000;

export const unauthenticatedFunctionRule: Rule = {
  id: "unauthenticated-function",
  description: "Flags serverless functions that anyone on the internet can call without authentication.",
  run({ files, config }) {
    if (!config.rules.unauthenticatedFunction.enabled) {
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
        // Development, example, and test stacks are torn down after use.
        developmentPath.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const lines = patchLines(file.patch);
      const text = lines.map(({ content }) => content).join("\n");
      const active = fileSettings.filter(({ context }) => context === undefined || context.test(text));
      const python = /\.py$/i.test(file.path);
      const found: Array<{ line: number; label: string }> = [];
      // Python docstrings show examples, as the AWS CDK's do.
      let inDocstring = false;
      for (const { line, content, added, startsHunk } of lines) {
        if (startsHunk) {
          inDocstring = false;
        }
        const wasInDocstring = inDocstring;
        if (python && (content.match(/"""|\'\'\'/g) ?? []).length % 2 === 1) {
          inDocstring = !inDocstring;
        }
        if (!added || wasInDocstring || content.length > maxLineLength || commentLine.test(content)) {
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
          ruleId: "unauthenticated-function",
          title: "Function open to anyone",
          severity: "warning" as const,
          file: file.path,
          line: lineNumbers[0],
          lines: lineNumbers,
          message: `${where} ${plural ? "let" : "lets"} anyone on the internet call ${listOf(labels)} without authentication, so unless the function checks each caller itself, such as a webhook's signature or a token, anyone can run it, read what it returns, and run up its bill.`,
          recommendation:
            "Require the platform's authentication, such as `AWS_IAM` function URLs, Cloud Run's IAM invoker role without `--allow-unauthenticated`, or Azure's `function` or `admin` level, and put public endpoints behind an API gateway with authentication and rate limits. When a function must stay public, such as a webhook, check every request's signature in the function."
        }
      ];
    });
  }
};
