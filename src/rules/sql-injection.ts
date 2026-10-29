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
  /\bselect\s.{1,500}?\bfrom\b|\binsert\s+into\b|\bupdate\s+[\w."`[\]]+\s+set\b|\bdelete\s+from\b|\bwhere\s+[\w."`[\]]+\s*(?:[=<>!]|like\b|in\b|is\b)|\b(?:order|group)\s+by\b|\bvalues\s*\(/i;

// Values inserted into the query text rather than passed as parameters. Operators are looked for
// outside the text of strings, so a template such as `"%(field)s = VALUES(%(field)s)"` does not count.
const builtString: Array<{ pattern: RegExp; operator?: true }> = [
  { pattern: /(?:^|[(\s,])(?:[rR]?[fF]|[fF][rR])["']/ }, // Python f-string, also inside text(...)
  { pattern: /["']\s*%\s*[\w(]/, operator: true }, // Python "... %s" % value
  { pattern: /["']\.format\(/, operator: true }, // Python and C# .format()
  { pattern: /`[^`]*\$\{/ }, // JavaScript template literal
  { pattern: /["'`]\s*\+\s*[\w$(]|[\w)\]]\s*\+\s*["'`]/, operator: true }, // concatenation
  { pattern: /\b(?:fmt\.Sprintf|String\.format|sprintf)\s*\(/ }, // Go, Java, PHP
  { pattern: /"[^"]*#\{/ } // Ruby interpolation
];
// The text inside single and double quotes, which masking replaces so operators are not read in it.
const quotedText = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

// Values that pass through a function that quotes an identifier or escapes a value for SQL, such as
// Django's `quote_name(...)`, Sequelize's `this.quoteTable(...)`, or Rails' `quote_table_name(...)`,
// and variables named for the result, such as `quotedTable`.
const quotedValue =
  /^\s*(?:(?:[\w$]+\.)*(?:quote_name|quote_table_name|quote_column_name|quoteTable|quoteIdentifiers?|quote_ident|quoteName|escapeId|escapeIdentifier|escapeLiteral|escape_string|escape|quote|sanitize_sql\w*)\s*\([^]*\)|(?:quoted|escaped)[\w$]*)\s*$/;
const templateValue = /\$\{((?:[^{}]|\{[^{}]*\})*)\}/g;
const rubyValue = /#\{((?:[^{}]|\{[^{}]*\})*)\}/g;
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

      const patterns = [...builtString, ...languageStrings.filter(([files]) => files.test(file.path)).map(([, pattern]) => ({ pattern }))];
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
          lines: lines,
          message: `${text} ${plural ? "build" : "builds"} SQL from values inserted into the query text, which allows SQL injection unless every value is escaped.`,
          recommendation:
            "Pass values as query parameters (?, $1, %s with a separate argument, or named parameters) and keep the SQL text constant. For identifiers such as column names, choose from a fixed list."
        }
      ];
    });
  }
};

// The argument of a SQL call, on the call's line or, when the call ends with `(`, on the next line.
function findBuiltSql(patch: string, patterns: Array<{ pattern: RegExp; operator?: true }>): number[] {
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
      builds(checked.argument, patterns) &&
      (sqlKeyword.test(checked.argument) || (fragmentCall.test(checked.name) && /^\s*\(?\s*"[^"]*#\{/.test(checked.argument)))
    ) {
      found.push(line);
    }
  }

  return found;
}

function builds(argument: string, patterns: Array<{ pattern: RegExp; operator?: true }>): boolean {
  const masked = argument.replace(quotedText, (text) => `${text[0]}${"x".repeat(text.length - 2)}${text[0]}`);
  const matched = patterns.filter(({ pattern, operator }) => pattern.test(operator ? masked : argument));
  if (matched.length === 0) {
    return false;
  }
  // Interpolation that only inserts quoted identifiers or escaped values is not reported: template
  // literals, Ruby strings, and Python's `%` operator. Other ways of building the text, such as
  // concatenation, are not read that closely.
  const readable = [builtString[1], builtString[3], builtString[6]].map((entry) => entry?.pattern);
  if (!matched.every(({ pattern }) => readable.includes(pattern))) {
    return true;
  }
  const values = [...argument.matchAll(templateValue), ...argument.matchAll(rubyValue)].map((match) => match[1] ?? "");
  const percent = /["']\s*%\s*/.exec(masked);
  if (percent !== null) {
    values.push(...percentOperands(argument.slice(percent.index + percent[0].length)));
  }
  return !(values.length > 0 && values.every((value) => quotedValue.test(value)));
}

// The values after Python's `%`: one expression, or the items of a tuple. Brackets that close the
// surrounding call are left out.
function percentOperands(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      break;
    }
    current += char;
  }
  const operand = current.trim();
  const tuple = /^\((.*)\)$/s.exec(operand)?.[1];
  if (tuple === undefined) {
    items.push(operand);
    return items;
  }
  depth = 0;
  current = "";
  for (const char of tuple) {
    if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current);
  return items.filter((item) => item.trim() !== "");
}
