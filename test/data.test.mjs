import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDataset } from "../src/schema.mjs";

test("the committed dataset satisfies the contract", async () => {
  const raw = await readFile(new URL("../data/copenhagen-2026.json", import.meta.url), "utf8");
  const problems = validateDataset(JSON.parse(raw));
  assert.deepEqual(problems, [], `dataset problems:\n${problems.join("\n")}`);
});
