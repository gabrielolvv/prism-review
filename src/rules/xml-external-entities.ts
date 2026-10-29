import { minimatch } from "minimatch";
import { patchLines } from "../analysis/added-lines.js";
import { isTestDataPath } from "../analysis/repository-path.js";
import type { Rule } from "../analysis/rule.js";
import { describeLines } from "./line-list.js";

// Settings that turn on what XML parsers leave off, or should: document type definitions (DTDs),
// and entities that read files or URLs. A document with `<!ENTITY x SYSTEM "file:///etc/passwd">`
// then reads local files or reaches internal hosts (XXE).
const settings: RegExp[] = [
  // lxml and Python's SAX parser.
  /\b(?:resolve_entities|load_dtd)\s*=\s*True\b|\bno_network\s*=\s*False\b/,
  /\bsetFeature\(\s*(?:[\w.]{0,40}\.)?feature_external_(?:ges|pes)\s*,\s*(?:True|1)\s*\)/,
  // Java's DocumentBuilderFactory, SAXParserFactory, XMLInputFactory, and TransformerFactory.
  /\bsetFeature\(\s*"http:\/\/(?:apache\.org\/xml\/features\/disallow-doctype-decl"\s*,\s*false|xml\.org\/sax\/features\/external-(?:general|parameter)-entities"\s*,\s*true|apache\.org\/xml\/features\/nonvalidating\/load-external-dtd"\s*,\s*true)\s*\)/,
  /\bsetExpandEntityReferences\(\s*true\s*\)/,
  /\bsetProperty\(\s*(?:XMLInputFactory\.(?:SUPPORT_DTD|IS_SUPPORTING_EXTERNAL_ENTITIES)|"javax\.xml\.stream\.(?:supportDTD|isSupportingExternalEntities)")\s*,\s*(?:true|Boolean\.TRUE)\s*\)/,
  /\b(?:setAttribute|setProperty)\(\s*XMLConstants\.ACCESS_EXTERNAL_(?:DTD|SCHEMA|STYLESHEET)\s*,\s*"all"\s*\)/,
  // PHP's libxml.
  /\blibxml_disable_entity_loader\(\s*false\s*\)|\bLIBXML_(?:NOENT|DTDLOAD)\b|->(?:substituteEntities|resolveExternals)\s*=\s*true\b/i,
  // .NET's XmlReaderSettings and XmlDocument.
  /\bDtdProcessing\s*=\s*DtdProcessing\.Parse\b|\bProhibitDtd\s*=\s*false\b|\bXmlResolver\s*=\s*new\s+XmlUrlResolver\s*\(/,
  // libxmljs in Node.js.
  /\b(?:noent|dtdload)\s*:\s*true\b/,
  // Nokogiri and libxml-ruby.
  /\bconfig\.(?:noent|dtdload)\b|\b(?:ParseOptions|Options)::(?:NOENT|DTDLOAD)\b/
];

const commentLine = /^\s*(?:#|\/\/|\/\*|\*|--)/;
// Python's PKG-INFO holds the package's README, and XML libraries document the unsafe settings.
const documentation = /\.(?:md|mdx|markdown|rst|txt|adoc|asciidoc|html?)$|(?:^|\/)(?:PKG-INFO|README|CHANGES|CHANGELOG|HISTORY|NEWS)$/i;

export const xmlExternalEntitiesRule: Rule = {
  id: "xml-external-entities",
  description: "Flags XML parser settings that turn on DTDs or external entities, which let a document read local files or reach internal hosts.",
  run({ files, config }) {
    if (!config.rules.xmlExternalEntities.enabled) {
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

      const lines = patchLines(file.patch).flatMap(({ line, content, added }) =>
        added && !commentLine.test(content) && settings.some((pattern) => pattern.test(content)) ? [line] : []
      );
      if (lines.length === 0) {
        return [];
      }

      const { text, plural } = describeLines(lines);
      return [
        {
          ruleId: "xml-external-entities",
          title: "XML external entities turned on",
          severity: "warning" as const,
          file: file.path,
          line: lines[0],
          lines,
          message: `${text} ${plural ? "turn" : "turns"} on DTDs or external entities in an XML parser, which lets a document read local files or reach internal hosts (XXE).`,
          recommendation:
            "Keep DTDs and external entities off for XML that comes from users or other systems: set disallow-doctype-decl to true in Java, leave resolve_entities and no_network at safe values in lxml or use defusedxml, drop the NOENT and DTDLOAD flags in PHP, and use DtdProcessing.Prohibit in .NET."
        }
      ];
    });
  }
};
