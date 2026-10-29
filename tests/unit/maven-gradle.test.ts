import assert from "node:assert/strict";
import { analyzePullRequest } from "../../src/analysis/analyze-pull-request.js";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { dependencyChanges } from "../../src/analysis/manifest-dependencies.js";
import { defaultConfig } from "../../src/config/schema.js";
import { renderMarkdown } from "../../src/reporting/render-markdown.js";

export function testMavenDependenciesAreReadAcrossLines(): void {
  const changes = dependencyChanges([
    changed("pom.xml", [
      "@@ -20,17 +20,22 @@",
      "     <dependency>",
      "       <groupId>org.springframework</groupId>",
      "       <artifactId>spring-core</artifactId>",
      "-      <version>6.1.0</version>",
      "+      <version>6.1.2</version>",
      "     </dependency>",
      // Unchanged blocks in the context are not changes.
      "     <dependency>",
      "       <groupId>junit</groupId>",
      "       <artifactId>junit</artifactId>",
      "       <version>4.13.2</version>",
      "     </dependency>",
      "+    <dependency>",
      "+      <groupId>com.google.guava</groupId>",
      "+      <artifactId>guava</artifactId>",
      "+      <version>${guava.version}</version>",
      "+      <exclusions><exclusion><groupId>x</groupId><artifactId>y</artifactId></exclusion></exclusions>",
      "+    </dependency>",
      "-    <dependency><groupId>commons-io</groupId><artifactId>commons-io</artifactId><version>2.11.0</version></dependency>"
    ]),
    // A hunk that starts inside a block reads the block from what it shows.
    changed("api/pom.xml", ["@@ -40,4 +40,4 @@", "       <artifactId>okhttp</artifactId>", "-      <version>4.11.0</version>", "+      <version>4.12.0</version>", "     </dependency>"])
  ]);

  assert.deepEqual(
    changes.map(({ file, name, from, to, line }) => [file, name, from, to, line]),
    [
      ["pom.xml", "org.springframework:spring-core", "6.1.0", "6.1.2", 23],
      ["pom.xml", "com.google.guava:guava", undefined, "${guava.version}", 30],
      ["pom.xml", "commons-io:commons-io", "2.11.0", undefined, undefined]
    ]
  );
}

export function testGradleDependenciesAreRead(): void {
  const changes = dependencyChanges([
    changed("app/build.gradle.kts", [
      "@@ -10,4 +10,8 @@ dependencies {",
      '-    implementation("com.squareup.okhttp3:okhttp:4.11.0")',
      '+    implementation("com.squareup.okhttp3:okhttp:4.12.0")',
      '+    testImplementation("org.junit.jupiter:junit-jupiter")',
      '+    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.2.0"))',
      '+    kapt("com.google.dagger:dagger-compiler:2.50")',
      '     id("org.jetbrains.kotlin.jvm") version "1.9.22"'
    ]),
    changed("build.gradle", ["@@ -1,2 +1,3 @@", "+    implementation 'com.google.code.gson:gson:2.10.1'", "+    compileOnly group: 'org.projectlombok', name: 'lombok', version: '1.18.30'"]),
    changed("gradle/libs.versions.toml", [
      "@@ -1,6 +1,8 @@",
      " [versions]",
      ' kotlin = "1.9.22"',
      " [libraries]",
      '+retrofit = { module = "com.squareup.retrofit2:retrofit", version = "2.9.0" }',
      '+coroutines = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "coroutines" }',
      '+gson = "com.google.code.gson:gson:2.10.1"'
    ])
  ]);

  assert.deepEqual(
    changes.map(({ file, name, from, to }) => [file, name, from, to]),
    [
      ["app/build.gradle.kts", "com.squareup.okhttp3:okhttp", "4.11.0", "4.12.0"],
      ["app/build.gradle.kts", "org.junit.jupiter:junit-jupiter", undefined, ""],
      ["app/build.gradle.kts", "org.springframework.boot:spring-boot-dependencies", undefined, "3.2.0"],
      ["app/build.gradle.kts", "com.google.dagger:dagger-compiler", undefined, "2.50"],
      ["build.gradle", "com.google.code.gson:gson", undefined, "2.10.1"],
      ["build.gradle", "org.projectlombok:lombok", undefined, "1.18.30"],
      ["gradle/libs.versions.toml", "com.squareup.retrofit2:retrofit", undefined, "2.9.0"],
      ["gradle/libs.versions.toml", "org.jetbrains.kotlinx:kotlinx-coroutines-core", undefined, ""],
      ["gradle/libs.versions.toml", "com.google.code.gson:gson", undefined, "2.10.1"]
    ]
  );
}

export function testMavenAndGradleGoThroughTheDependencyRules(): void {
  const files = [
    changed("pom.xml", [
      "@@ -1,9 +1,9 @@",
      "     <dependency>",
      "       <groupId>org.apache.commons</groupId>",
      "-      <artifactId>commons-lang3</artifactId>",
      "+      <artifactId>commons-lamg3</artifactId>",
      "     </dependency>",
      "     <dependency>",
      "       <groupId>com.google.guava</groupId>",
      "       <artifactId>guava</artifactId>",
      // Moving the version to a BOM leaves it managed, not open.
      "-      <version>32.1.3-jre</version>",
      "     </dependency>"
    ]),
    changed("build.gradle", ["@@ -1,2 +1,3 @@", "-    implementation 'com.squareup.okhttp3:okhttp:4.12.0'", "+    implementation 'com.squareup.okhttp3:okhttp:+'", "+    implementation 'com.google.code.gson:gson:latest.release'"])
  ];
  const result = analyzePullRequest(files, defaultConfig, { existingLockfiles: new Set(["gradle.lockfile"]) });
  const messages = (ruleId: string) => result.findings.filter((finding) => finding.ruleId === ruleId).map((finding) => finding.message);

  assert.deepEqual(messages("lookalike-dependency"), [
    "Line 3 adds org.apache.commons:commons-lamg3 (like org.apache.commons:commons-lang3): a name one character away from a popular Maven package, a common way to slip in a malicious one."
  ]);
  assert.deepEqual(messages("risky-dependency-version"), [
    "Lines 1, 2 change dependency versions: com.squareup.okhttp3:okhttp from 4.12.0 to +, which accepts any future release; com.google.code.gson:gson at latest.release, which accepts any release."
  ]);
  assert.deepEqual(result.findings.filter((finding) => finding.ruleId === "stale-lockfile").map((finding) => finding.file), ["build.gradle"]);
  // The version moved to a BOM, so the dependency changed rather than went away.
  assert.deepEqual(
    (result.dependencyChanges ?? []).filter((change) => change.name === "com.google.guava:guava").map(({ from, to }) => [from, to]),
    [["32.1.3-jre", ""]]
  );
  assert.match(renderMarkdown(result), /^\| `pom\.xml` \| `com\.google\.guava:guava` \| `32\.1\.3-jre` to `managed` \|$/m);
}

function changed(path: string, lines: string[]): ChangedFile {
  return {
    path,
    status: "modified",
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch: lines.join("\n")
  };
}
