import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { xmlExternalEntitiesRule } from "../../src/rules/xml-external-entities.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return xmlExternalEntitiesRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testXmlExternalEntitiesReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/feeds.py", [
      "from lxml import etree",
      "parser = etree.XMLParser(resolve_entities=True, no_network=False)",
      "tree = etree.fromstring(body, parser)",
      "handler.setFeature(xml.sax.handler.feature_external_ges, True)"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "XML external entities turned on");
  assert.deepEqual(finding?.lines, [2, 4]);
  assert.equal(
    finding?.message,
    "Lines 2, 4 turn on DTDs or external entities in an XML parser, which lets a document read local files or reach internal hosts (XXE)."
  );
}

export function testXmlExternalEntitiesReadsEachParser(): void {
  const cases: Array<[string, string]> = [
    ["app/import.py", "parser = etree.XMLParser(load_dtd=True)"],
    ["src/main/java/Import.java", 'factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);'],
    ["src/main/java/Sax.java", 'spf.setFeature("http://xml.org/sax/features/external-general-entities", true);'],
    ["src/main/java/Dtd.java", 'dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", true);'],
    ["src/main/java/Expand.java", "dbf.setExpandEntityReferences(true);"],
    ["src/main/java/Stax.java", "xif.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, true);"],
    ["src/main/java/StaxDtd.java", 'xif.setProperty("javax.xml.stream.supportDTD", Boolean.TRUE);'],
    ["src/main/java/Transform.java", 'tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "all");'],
    ["lib/import.php", "libxml_disable_entity_loader(false);"],
    ["lib/feed.php", "$doc->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD);"],
    ["lib/dom.php", "$doc->substituteEntities = true;"],
    ["Import.cs", "var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Parse };"],
    ["Legacy.cs", "doc.XmlResolver = new XmlUrlResolver();"],
    ["src/feed.js", "const doc = libxmljs.parseXml(body, { noent: true });"],
    ["app/services/import.rb", "doc = Nokogiri::XML(body) { |config| config.noent }"],
    ["app/services/feed.rb", "doc = Nokogiri::XML(body, nil, nil, Nokogiri::XML::ParseOptions::DTDLOAD)"]
  ];
  for (const [path, line] of cases) {
    assert.equal(findings([added(path, [line])]).length, 1, `${path}: ${line}`);
  }
}

export function testXmlExternalEntitiesSkipsSafeSettings(): void {
  const safe = [
    // The settings that keep DTDs and entities off.
    "parser = etree.XMLParser(resolve_entities=False, no_network=True)",
    'factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);',
    'spf.setFeature("http://xml.org/sax/features/external-general-entities", false);',
    "xif.setProperty(XMLInputFactory.SUPPORT_DTD, false);",
    'tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");',
    "var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit };",
    "doc.XmlResolver = null;",
    "const doc = libxmljs.parseXml(body, { noent: false });",
    "doc = Nokogiri::XML(body) { |config| config.strict.nonet }",
    "tree = defusedxml.ElementTree.fromstring(body)",
    // Comments.
    "# parser = etree.XMLParser(resolve_entities=True)",
    "// dbf.setExpandEntityReferences(true);"
  ];

  assert.deepEqual(findings([added("src/parse.ts", safe)]), []);
}

export function testXmlExternalEntitiesSkipsTestsAndDocs(): void {
  const line = "parser = etree.XMLParser(resolve_entities=True)";

  assert.deepEqual(findings([added("tests/test_feeds.py", [line]), added("docs/xml.md", [line]), added("defusedxml.egg-info/PKG-INFO", [line]), added("fixtures/xxe/parse.py", [line])]), []);
}

export function testXmlExternalEntitiesCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { xmlExternalEntities: { enabled: false } } });

  assert.deepEqual(findings([added("app/feeds.py", ["parser = etree.XMLParser(resolve_entities=True)"])], config), []);
}
