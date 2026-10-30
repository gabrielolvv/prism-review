import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

type Kind = "ldap" | "xpath";

// In the order the message lists them.
const labels: Record<Kind, string> = {
  ldap: "an LDAP filter, where a value such as `*)(uid=*` can match every user",
  xpath: "an XPath expression, where a value such as `' or '1'='1` can select every node"
};

// Text shaped like each language, inside quotes: `(uid=`, `(&(objectClass=user)(cn=`, or `[name='`,
// `[@id=`, `//user[`.
const shapes: Record<Kind, RegExp> = {
  ldap: /["'`][^"'`]*\(\s*[&|!]?\s*\(?\s*[A-Za-z][\w.-]*\s*[~<>]?=[^"'`]*/,
  xpath: /["'`][^"'`]*(?:\/\/?[\w*@.:-]*\[|\[\s*@?[\w.:-]+\s*=|\[\s*(?:contains|starts-with|text)\s*\()[^"'`]*/
};

// Calls that run an LDAP search or an XPath query.
const sinks: Record<Kind, RegExp> = {
  ldap:
    /(?:\.|->)search(?:_s|_st|_ext|_ext_s|ForObject)?\s*\(|\bldap_(?:search|list|read)\s*\(|\bDirectorySearcher\s*\(|\.Filter\s*=(?!=)|\bNewSearchRequest\s*\(|\bnew\s+SearchRequest\s*\(|\.authenticate\s*\(|\bfilter\s*:/,
  xpath:
    /(?:\.|->)(?:xpath|at_xpath|selectNodes|selectSingleNode|SelectNodes|SelectSingleNode|XPathSelectElements?|XPathEvaluate)\s*\(|\b[xX][pP]ath\w*(?:\.|->)(?:evaluate|compile|query|select1?|Select|Evaluate|Compile)\s*\(|\bXPath(?:\.(?:first|match|each))?\s*\(|\b(?:document|doc)\.evaluate\s*\(/
};

// A value inserted into the text rather than escaped or bound. Operators are looked for outside the
// text of strings, so the `+` in a regular expression such as `"[^/]+"` does not count.
const inserted: Array<{ pattern: RegExp; operator?: true }> = [
  { pattern: /(?:^|[(\s,=])(?:[rR]?[fF]|[fF][rR])(?:"[^"]*\{|'[^']*\{)/ }, // Python f-string
  { pattern: /["']\s*%\s*[\w(]/, operator: true }, // Python "... %s" % value
  { pattern: /["']\.format\(/, operator: true }, // Python and C# .format()
  { pattern: /`[^`]*\$\{/ }, // JavaScript template literal
  { pattern: /["'`]\s*\+\s*[\w$(]|[\w$)\]]\s*\+\s*["'`]/, operator: true }, // concatenation
  { pattern: /\b(?:fmt\.Sprintf|String\.format|sprintf)\s*\(/ }, // Go, Java, PHP
  { pattern: /"[^"]*#\{/ } // Ruby interpolation
];
const quotedText = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
// PHP and C# interpolate in their own string syntax, which means something else elsewhere: `$name`
// in lxml's XPath is a bound variable.
const languageInserted: Array<[RegExp, RegExp]> = [
  [/\.php$/i, /"[^"]*\$[a-zA-Z_{]|["']\s*\.\s*\$|\$\w+\s*\.\s*["']/],
  [/\.cs$/i, /\$@?"[^"]*\{/]
];
// Escaping and binding functions for LDAP filters and XPath, on the line that builds the text.
const escaped =
  /escape_filter_chars|ldap_escape|escapeFilter|escape_filter|filterEncode|EscapeFilter|escapeLDAP|encodeForLDAP|encodeForDN|LdapEncoder|Filter\.(?:createEqualityFilter|create)|EqualsFilter|LdapQueryBuilder|encodeForXPath|escapeXPath|xpathEscape|XPathVariableResolver|setXPathVariableResolver/i;
const assignment = /^\s*(?:(?:const|let|var|final|String|string|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]]+\s*)?(?::=|=)(?!=)/;
// How far, in lines, a built string is followed to a call.
const reach = 20;

const sourceFile = /\.(?:[cm]?[jt]sx?|py|rb|php|java|kt|scala|cs|go)$/i;
const skippedFile = /\.d\.[cm]?ts$|\.min\.[cm]?js$/i;
const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
const maxLineLength = 1_000;

export const ldapXpathInjectionRule: Rule = {
  id: "ldap-xpath-injection",
  description: "Flags LDAP filters and XPath expressions built by inserting values into their text.",
  run({ files, config }) {
    if (!config.rules.ldapXpathInjection.enabled) {
      return [];
    }

    const testGlobs = config.rules.missingTests.testGlobs;

    return files.flatMap((file) => {
      if (
        file.patch === undefined ||
        !sourceFile.test(file.path) ||
        skippedFile.test(file.path) ||
        isTestDataPath(file.path) ||
        testGlobs.some((glob) => minimatch(file.path, glob))
      ) {
        return [];
      }

      const patterns = [...inserted, ...languageInserted.filter(([files]) => files.test(file.path)).map(([, pattern]) => ({ pattern }))];
      const found = findBuiltQueries(file.patch, patterns);
      if (found.length === 0) {
        return [];
      }

      const lines = [...new Set(found.map((match) => match.line))].sort((a, b) => a - b);
      const kinds = (Object.keys(labels) as Kind[]).filter((kind) => found.some((match) => match.kind === kind));
      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "ldap-xpath-injection",
          title: "LDAP or XPath query built from text",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "insert values into" : "inserts a value into"} ${kinds.map((kind) => labels[kind]).join(", and ")}.`,
          recommendation:
            "Escape each value for the query language before inserting it, such as `escape_filter_chars` in python-ldap and ldap3, `ldap_escape` in PHP, `ldap.EscapeFilter` in Go, or `LdapEncoder.filterEncode` in Spring, or build filters with a library's filter objects. For XPath, bind values as variables, such as `tree.xpath(\"//user[name=$name]\", name=name)` in lxml or an `XPathVariableResolver` in Java."
        }
      ];
    });
  }
};

function findBuiltQueries(patch: string, insertedPatterns: Array<{ pattern: RegExp; operator?: true }>): Array<{ line: number; kind: Kind }> {
  const lines = patchLines(patch);
  const found: Array<{ line: number; kind: Kind }> = [];
  lines.forEach(({ line, content, added }, index) => {
    if (!added || content.length > maxLineLength || commentLine.test(content) || escaped.test(content)) {
      return;
    }
    // Operators are read with the text of strings blanked out, keeping the quotes.
    const masked = content.replace(quotedText, (text) => `${text[0]}${text[0]}`);
    if (!insertedPatterns.some(({ pattern, operator }) => pattern.test(operator ? masked : content))) {
      return;
    }
    for (const kind of Object.keys(shapes) as Kind[]) {
      if (!shapes[kind].test(content)) {
        continue;
      }
      // Run on the same line, or stored in a name that a later call within reach receives.
      const name = assignment.exec(content)?.[1];
      const reaches =
        sinks[kind].test(content) ||
        (name !== undefined &&
          lines
            .slice(index + 1)
            .some(
              (later) =>
                later.line - line <= reach &&
                sinks[kind].test(later.content) &&
                new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(later.content.slice(later.content.search(sinks[kind])))
            ));
      if (reaches) {
        found.push({ line, kind });
      }
    }
  });
  return found;
}
