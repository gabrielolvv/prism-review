// Prints the CHANGELOG.md section for one version, as the notes of its GitHub release.
// Usage: node scripts/release-notes.mjs v0.19.1 (the leading "v" is optional)
import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail("Usage: node scripts/release-notes.mjs <version>, such as v0.19.1.");
}

const lines = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} - `));
if (start < 0) {
  fail(`CHANGELOG.md has no section for ${version}.`);
}

const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
const notes = lines.slice(start + 1, next < 0 ? lines.length : next).join("\n").trim();
if (notes === "") {
  fail(`The CHANGELOG.md section for ${version} is empty.`);
}

process.stdout.write(`${notes}\n`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
