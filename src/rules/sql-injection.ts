import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Calls that run their first argument as SQL. `exec` is left out: it usually starts a process.
const sqlCall =
  /(?:^|[^\w$])(execute|executemany|executescript|query|raw|executeQuery|executeUpdate|addBatch|createQuery|createNativeQuery|prepareStatement|Query|QueryRow|QueryContext|QueryRowContext|Exec|ExecContext|FromSqlRaw|ExecuteSqlRaw|SqlCommand|find_by_sql|select_all|select_one|select_value|where|order|having|joins|mysqli_query|pg_query|read_sql|read_sql_query|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(/;
// SQL built into a variable first, such as `String sql = "SELECT ..." + id;`, then run elsewhere.
const sqlVariable = /\b\w*(?:sql|query|stmt|statement)\w*\s*(?::\s*[\w<>[\]]+\s*)?=(?!=)/i;
// ActiveRecord takes SQL fragments without keywords, such as `where("email = '#{email}'")`.
const fragmentCall = /^(?:where|order|having|joins|find_by_sql|select_all|select_one|select_value)$/;
// SQL structure rather than single words, so English text such as "email from {sender}" does not count.
const sqlKeyword =
  /\bselect\s.+?\bfrom\b|\binsert\s+into\b|\bupdate\s+[\w."`[\]]+\s+set\b|\bdelete\s+from\b|\bwhere\s+[\w."`[\]]+\s*(?:[=<>!]|like\b|in\b|is\b)|\b(?:order|group)\s+by\b|\bvalues\s*\(/i;

// Values inserted into the query text rather than passed as parameters.
const builtString = [
  /(?:^|[(\s,])(?:[rR]?[fF]|[fF][rR])["']/, // Python f-string, also inside text(...)
  /["']\s*%\s*[\w(]/, // Python "... %s" % value
  /["']\.format\(/, // Python and C# .format()
  /`[^`]*\$\{/, // JavaScript template literal
  /["'`]\s*\+\s*[\w$(]|[\w)\]]\s*\+\s*["'`]/, // concatenation
  /\b(?:fmt\.Sprintf|String\.format|sprintf)\s*\(/, // Go, Java, PHP
  /"[^"]*#\{/ // Ruby interpolation
];
// PHP and C# interpolate in their own string syntax, which means something else elsewhere.
const languageStrings: Array<[RegExp, RegExp]> = [
  [/\.php$/i, /"[^"]*\$[a-zA-Z_]|"\s*\.\s*\$|\$\w+\s*\.\s*"/],
  [/\.cs$/i, /\$@?"[^"]*\{/]
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$/i;

export const sqlInjectionRule: Rule = {
  id: "sql-injection",
  description: "Flags SQL built by inserting values into the query text instead of passing them as parameters.",
  run({ files, config }) {
    if (!config.rules.sqlInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        documentation.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const patterns = [...builtString, ...languageStrings.filter(([files]) => files.test(file.path)).map(([, pattern]) => pattern)];
      const lines = findBuiltSql(file.patch, patterns);
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "sql-injection",
          title: "SQL built from values",
          severity: "warning" as const,
          file: file.path,
          line: Math.min(...lines),
          message: `${text} ${plural ? "build" : "builds"} SQL from values inserted into the query text, which allows SQL injection unless every value is escaped.`,
          recommendation:
            "Pass values as query parameters (?, $1, %s with a separate argument, or named parameters) and keep the SQL text constant. For identifiers such as column names, choose from a fixed list."
        }
      ];
    });
  }
};

// The argument of a SQL call, on the call's line or, when the call ends with `(`, on the next line.
function findBuiltSql(patch: string, patterns: RegExp[]): number[] {
  const found: number[] = [];
  let pendingCall: string | undefined;

  for (const { line, content, added, startsHunk } of patchLines(patch)) {
    if (startsHunk) {
      pendingCall = undefined;
    }
    if (commentLine.test(content)) {
      continue;
    }

    const call = sqlCall.exec(content) ?? sqlVariable.exec(content);
    const target = call ? { name: call[1] ?? "", argument: content.slice(call.index + call[0].length) } : undefined;
    const checked = target ?? (pendingCall === undefined ? undefined : { name: pendingCall, argument: content });
    pendingCall = target !== undefined && target.argument.trim() === "" ? target.name : undefined;

    if (
      added &&
      checked !== undefined &&
      checked.argument.trim() !== "" &&
      patterns.some((pattern) => pattern.test(checked.argument)) &&
      (sqlKeyword.test(checked.argument) || (fragmentCall.test(checked.name) && /#\{/.test(checked.argument)))
    ) {
      found.push(line);
    }
  }

  return found;
}
