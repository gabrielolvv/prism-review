import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "drops a table" | "drops a column" | "removes every row" | "changes a column definition" | "renames a table or column";

// In the order the message lists them. The first three lose data; the others break code that still
// uses the old name or type while the deploy rolls out.
const kinds: Array<{ kind: Kind; destructive: boolean; pattern: RegExp }> = [
  {
    kind: "drops a table",
    destructive: true,
    pattern:
      /\bdrop\s+(?:table|schema|database)\b|(?<!\w)(?:drop_table|drop_join_table|dropTable|dropTableIfExists|DropTable|DeleteModel)\b|\bSchema::drop(?:IfExists)?\s*\(/i
  },
  {
    kind: "drops a column",
    destructive: true,
    pattern:
      /\bdrop\s+column\b|\balter\s+table\b.*\bdrop\s+(?!(?:column|constraint|index|key|primary|foreign|check|default|not|partition|identity|expression|period|system|table|trigger)\b)["`[]?\w|(?<!\w)(?:remove_columns?|remove_reference|remove_belongs_to|remove_timestamps|drop_column|dropColumns?|DropColumn|removeColumn|RemoveField)\b|^\s*remove\s+:/i
  },
  {
    kind: "removes every row",
    destructive: true,
    pattern: /\btruncate\s+table\b|^\s*truncate\s+["`[]?\w|\bdelete\s+from\s+[\w."`[\]]+\s*;|\.truncate\s*\(\s*\)/i
  },
  {
    kind: "changes a column definition",
    destructive: false,
    pattern:
      /\balter\s+column\s+["`[]?[\w.]+["`\]]?\s+(?!(?:set|drop|add|reset|restart|options)\b)\w|\b(?:modify|change)\s+column\b|(?<!\w)(?:change_column(?!_)|changeColumn|AlterColumn)\b|->change\s*\(\s*\)|\.alter\s*\(\s*\)|\balter_column\s*\([^)]*\btype_\s*=|^\s*modify\s+:/i
  },
  {
    kind: "renames a table or column",
    destructive: false,
    pattern:
      /\brename\s+(?:(?:column|table)\s+)?(?:[\w."`[\]]+\s+)?to\b|\bsp_rename\b|(?<!\w)(?:rename_table|rename_column|renameTable|renameColumn|RenameTable|RenameColumn|RenameField|RenameModel)\b|\bSchema::rename\s*\(|^\s*rename\s+table\s*\(|\balter_column\s*\([^)]*\bnew_column_name\s*=/i
  }
];

// Directories such as `migrations/`, Rails' `db/migrate/`, Flyway's `db/migration/`, and Alembic's
// `alembic/versions/`, or SQL files named the way migration tools name them.
const migrationPath = /(?:^|\/)[^/]*(?:migrat|alembic)[^/]*\/|(?:^|\/)(?:V\d[^/]*__[^/]*|[^/]*\.up)\.sql$/i;
const migrationFile = /\.(?:sql|rb|py|[cm]?[jt]s|php|cs|go|java|kt|exs?)$/i;
// golang-migrate, sqlx, and Diesel keep rollbacks in their own files; Flyway names them `U<version>__`.
const rollbackFile = /(?:^|[._/-])down\.sql$|(?:^|\/)U\d[^/]*__[^/]*\.sql$/i;

// A rollback section undoes the migration, so dropping what `up` created there is expected.
const rollbackStart =
  /^\s*(?:def\s+(?:self\.)?down(?:grade)?\b|(?:(?:public|protected|private|internal|override|static|async|export|function|void)\s+)*[Dd]own\s*\(|(?:module\.)?exports\.down\s*=|down\s*:\s*(?:async\s*)?(?:function\b|\()|func\s+(?:[Dd]own\w*|\w*Down\w*)\s*\()|^\s*--\s*(?:\+(?:goose|migrate)\s+down|migrate:down)\b/i;
const forwardStart =
  /^\s*(?:def\s+(?:self\.)?(?:up(?:grade)?|change)\b|(?:(?:public|protected|private|internal|override|static|async|export|function|void)\s+)*[Uu]p\s*\(|(?:module\.)?exports\.up\s*=|up\s*:\s*(?:async\s*)?(?:function\b|\()|func\s+(?:[Uu]p\w*|\w*Up\w*)\s*\()|^\s*--\s*(?:\+(?:goose|migrate)\s+up|migrate:up)\b/i;
const commentLine = /^\s*(?:--|#|\/\/|\/\*|\*)/;
// Any other function or method ends a rollback that started at the same or a deeper indentation.
const definition =
  /^(\s*)(?:(?:public|protected|private|internal|override|static|async|export|void)\s+)*(?:def\s+(?:self\.)?|function\s+|func\s+(?:\([^)]*\)\s*)?)(\w+)/;

export const destructiveMigrationRule: Rule = {
  id: "destructive-migration",
  description: "Flags migrations that drop tables or columns, delete every row, or rename or redefine columns.",
  run({ files, config }) {
    if (!config.rules.destructiveMigration.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !migrationPath.test(file.path) ||
        !migrationFile.test(file.path) ||
        rollbackFile.test(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const found = findChanges(file.path, file.patch);
      if (found.length === 0) {
        return [];
      }

      const listed = kinds.filter(({ kind }) => found.some((match) => match.kind === kind));
      const destructive = listed.some((entry) => entry.destructive);
      const { text, plural } = describeLines(found.map((match) => match.line));
      const many = plural || listed.length > 1;

      return [
        {
          ruleId: "destructive-migration",
          title: destructive ? "Destructive migration added" : "Breaking schema change added",
          severity: destructive ? ("high" as const) : ("warning" as const),
          file: file.path,
          line: Math.min(...found.map((match) => match.line)),
          lines: found.map((match) => match.line),
          message: `${text} ${plural ? "change" : "changes"} the database in ${many ? "ways that are" : "a way that is"} hard to undo: ${listed.map((entry) => entry.kind).join(", ")}.`,
          recommendation:
            "Back up the affected data and deploy in steps: stop using the table or column in one release, then drop or rename it in a later one, so running code does not break. Check that the migration can be rolled back."
        }
      ];
    });
  }
};

function findChanges(path: string, patch: string): Array<{ line: number; kind: Kind }> {
  const found: Array<{ line: number; kind: Kind }> = [];
  const sql = /\.sql$/i.test(path);
  let rollbackIndent: number | undefined;
  let inBlockComment = false;

  for (const { line, content, added, startsHunk, hunkContext } of patchLines(patch)) {
    // Git names the enclosing function after `@@`, which tells where a hunk starts.
    if (startsHunk) {
      rollbackIndent = rollbackStart.test(hunkContext ?? "") ? indentation(hunkContext ?? "") : undefined;
      inBlockComment = false;
    }
    const defined = definition.exec(content);
    if (rollbackStart.test(content)) {
      rollbackIndent = indentation(content);
    } else if (
      forwardStart.test(content) ||
      (defined && rollbackIndent !== undefined && (defined[1] ?? "").length <= rollbackIndent)
    ) {
      rollbackIndent = undefined;
    }

    let code = content;
    if (sql) {
      ({ code, inBlockComment } = stripSqlComments(content, inBlockComment));
    }
    if (!added || rollbackIndent !== undefined || commentLine.test(code)) {
      continue;
    }
    for (const { kind, pattern } of kinds) {
      if (pattern.test(code)) {
        found.push({ line, kind });
      }
    }
  }

  return found;
}

function indentation(text: string): number {
  return /^\s*/.exec(text)?.[0].length ?? 0;
}

// Drops `--` and `/* */` comments, carrying an open block comment to the next line.
function stripSqlComments(content: string, inBlockComment: boolean): { code: string; inBlockComment: boolean } {
  let code = "";
  let rest = content;

  while (rest.length > 0) {
    if (inBlockComment) {
      const end = rest.indexOf("*/");
      if (end < 0) {
        break;
      }
      inBlockComment = false;
      rest = rest.slice(end + 2);
      continue;
    }

    const lineComment = rest.indexOf("--");
    const blockComment = rest.indexOf("/*");
    if (lineComment >= 0 && (blockComment < 0 || lineComment < blockComment)) {
      code += rest.slice(0, lineComment);
      break;
    }
    if (blockComment < 0) {
      code += rest;
      break;
    }
    code += `${rest.slice(0, blockComment)} `;
    inBlockComment = true;
    rest = rest.slice(blockComment + 2);
  }

  return { code, inBlockComment };
}
