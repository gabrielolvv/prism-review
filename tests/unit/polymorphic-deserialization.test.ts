import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { polymorphicDeserializationRule } from "../../src/rules/polymorphic-deserialization.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return polymorphicDeserializationRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

export function testPolymorphicDeserializationReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("src/main/java/com/acme/JsonConfig.java", [
      "ObjectMapper mapper = new ObjectMapper();",
      "mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);",
      "ParserConfig.getGlobalInstance().setAutoTypeSupport(true);"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "high");
  assert.equal(finding?.title, "Data chooses the classes to create");
  assert.deepEqual(finding?.lines, [2, 3]);
  assert.equal(
    finding?.message,
    "Lines 2, 3 turn on Jackson's default typing and fastjson's autoType, which let the data being read name the classes to create, so anyone who can send that data can chain classes on the classpath into running their own code on the server."
  );
}

export function testPolymorphicDeserializationReadsEachLibrary(): void {
  const cases: Array<[string, string[]]> = [
    ["src/main/java/Config.java", ["mapper.enableDefaultTyping();"]],
    ["src/main/java/Codec.java", ["JSON.parseObject(body, Order.class, Feature.SupportAutoType);"]],
    ["src/main/resources/application.properties", ["fastjson.parser.autoTypeSupport=true"]],
    ["src/main/java/Xml.java", ["xstream.addPermission(AnyTypePermission.ANY);"]],
    ["src/Api/Json.cs", ["var settings = new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.All };"]],
    ["src/Api/Legacy.cs", ["var serializer = new JavaScriptSerializer(new SimpleTypeResolver());"]],
    ["src/main/java/Cache.java", ["kryo.setRegistrationRequired(false);"]],
    ["src/main/java/RemoteConfig.java", ["return new HttpInvokerServiceExporter();"]],
    ["lib/cache.rb", ["data = Oj.load(payload, mode: :object)"]],
    ["app/state.py", ["state = jsonpickle.decode(request.body)"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.join(" | ")}`);
  }
}

export function testPolymorphicDeserializationSkipsSafeSettings(): void {
  const cases: Array<[string, string[]]> = [
    // Allowlists of types, and other modes.
    ["src/main/java/Config.java", ["mapper.activateDefaultTyping(BasicPolymorphicTypeValidator.builder().allowIfSubType(\"com.acme.\").build(), DefaultTyping.NON_FINAL);"]],
    ["src/main/java/Codec.java", ["ParserConfig.getGlobalInstance().setAutoTypeSupport(false);", "ParserConfig.getGlobalInstance().setSafeMode(true);"]],
    ["src/main/java/Xml.java", ["xstream.allowTypes(new Class[] { Order.class });"]],
    ["src/Api/Json.cs", ["var settings = new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.None };"]],
    ["src/Api/Json.cs", ["var settings = new JsonSerializerSettings {", "  TypeNameHandling = TypeNameHandling.Auto,", "  SerializationBinder = new KnownTypesBinder(),", "};"]],
    ["src/main/java/Cache.java", ["kryo.setRegistrationRequired(true);"]],
    ["lib/cache.rb", ["data = Oj.load(payload, mode: :strict)"]],
    ["app/state.py", ["state = jsonpickle.decode(request.body, safe=True)"]],
    // fastjson's own checks of the feature.
    ["src/main/java/com/alibaba/fastjson2/JSONReader.java", ["        return ((context.features | features) & Feature.SupportAutoType.mask) != 0;", "            if (feature == JSONReader.Feature.SupportAutoType) {", "            case JSONReader.Feature.SupportAutoType:", "boolean supportAutoType = context.isEnabled(JSONReader.Feature.SupportAutoType);", "import static com.alibaba.fastjson2.JSONReader.Feature.SupportAutoType;", "                rawFeature = JSONReader.Feature.SupportAutoType;"]],
    // Docstrings, examples, comments, and documentation.
    ["app/state.py", ["\"\"\"", "Do not call jsonpickle.decode(data) on untrusted input.", "\"\"\""]],
    ["examples/json/Config.java", ["mapper.enableDefaultTyping();"]],
    ["src/main/java/Config.java", ["// mapper.enableDefaultTyping();"]],
    ["docs/json.md", ["mapper.enableDefaultTyping();"]]
  ];
  for (const [path, lines] of cases) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.join(" | ")}`);
  }
}

export function testPolymorphicDeserializationSkipsTestsAndCanBeDisabled(): void {
  const lines = ["mapper.enableDefaultTyping();"];
  assert.deepEqual(findings([added("src/test/java/ConfigTest.java", lines)]), []);

  const config = prismConfigSchema.parse({ rules: { polymorphicDeserialization: { enabled: false } } });
  assert.deepEqual(findings([added("src/main/java/Config.java", lines)], config), []);
}
