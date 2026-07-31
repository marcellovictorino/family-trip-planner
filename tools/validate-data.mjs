#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateDataset } from "../src/schema.mjs";

const file = process.argv[2] ?? "data/copenhagen-2026.json";

const problems = validateDataset(JSON.parse(await readFile(file, "utf8")));

if (problems.length > 0) {
  console.error(`${file}: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`${file}: valid`);
