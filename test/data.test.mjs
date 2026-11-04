import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDataset } from "../src/schema.mjs";
import { canonicalMetro } from "../tools/metro.mjs";

test("the committed dataset satisfies the contract", async () => {
  const raw = await readFile(new URL("../data/copenhagen-2026.json", import.meta.url), "utf8");
  const problems = validateDataset(JSON.parse(raw));
  assert.deepEqual(problems, [], `dataset problems:\n${problems.join("\n")}`);
});

// TRIP-4 (td-920b3a): the padded metro box silently dropped the day-trips
// batch. These two are the ones the family named.
test("the committed dataset includes the day trips Louisiana and Bakken", async () => {
  const raw = await readFile(new URL("../data/copenhagen-2026.json", import.meta.url), "utf8");
  const { places } = JSON.parse(raw);
  for (const pattern of [/louisiana/i, /bakken/i]) {
    const place = places.find((p) => pattern.test(p.name));
    assert.ok(place, `no place matching ${pattern} in the dataset`);
    assert.equal(place.day_trip, true, `${place.name} should be flagged as a day trip`);
  }
});

// td-1e55cb: one station written under several spellings meant equal places
// could not be told apart for routing. A regenerated dataset must not bring the
// variants back, so every value must already be its canonical name.
test("every place's nearest_metro is already its canonical station name", async () => {
  const raw = await readFile(new URL("../data/copenhagen-2026.json", import.meta.url), "utf8");
  const { places } = JSON.parse(raw);
  const drift = places
    .filter((p) => canonicalMetro(p.nearest_metro) !== p.nearest_metro)
    .map((p) => `${p.name}: ${JSON.stringify(p.nearest_metro)}`);
  assert.deepEqual(drift, [], `non-canonical nearest_metro:\n${drift.join("\n")}`);
});
