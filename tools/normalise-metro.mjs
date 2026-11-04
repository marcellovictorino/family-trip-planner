#!/usr/bin/env node
// Rewrites every place's nearest_metro to its canonical station name (see
// tools/metro.mjs) and prints the distinct count before and after, with each
// changed value. A dry run unless --write is passed.
import { readFile, writeFile } from "node:fs/promises";
import { canonicalMetro } from "./metro.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const file = args.find((arg) => !arg.startsWith("--")) ?? "data/copenhagen-2026.json";

const data = JSON.parse(await readFile(file, "utf8"));
const before = new Set();
const after = new Set();
const changes = new Map();
let placesChanged = 0;

for (const place of data.places) {
  const raw = place.nearest_metro;
  const canonical = canonicalMetro(raw);
  before.add(raw);
  after.add(canonical);
  if (canonical !== raw) {
    changes.set(raw, canonical);
    placesChanged += 1;
  }
  place.nearest_metro = canonical;
}

console.log(`${file}`);
console.log(`  places: ${data.places.length}`);
console.log(`  distinct nearest_metro before: ${before.size}`);
console.log(`  distinct nearest_metro after: ${after.size}`);
console.log(`  places whose value changes: ${placesChanged}`);
console.log(`  distinct raw values rewritten: ${changes.size}`);
for (const [raw, canonical] of [...changes].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`    ${JSON.stringify(raw)} -> ${JSON.stringify(canonical)}`);
}

if (write) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  written: ${file}`);
} else {
  console.log("  dry run: pass --write to rewrite the file");
}
