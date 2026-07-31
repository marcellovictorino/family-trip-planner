import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlaces, matchesDuration, searchPlace, activeFilterCount, EMPTY_FILTERS } from "../src/filter.js";

function place(overrides = {}) {
  return {
    id: "x", name: "Somewhere", kind: "attraction", category: "museum",
    neighbourhood: "Indre By", description: "A pleasant place to spend an afternoon.",
    duration_minutes: 90, price_band: "€€", setting: "indoor",
    ages: ["toddler", "child", "adult"], baby_friendly: false, changing_table: false,
    gluten_free: "none", nearest_metro: "Nørreport", tags: ["quiet"],
    ...overrides,
  };
}

const withFilters = (overrides) => ({ ...EMPTY_FILTERS, ...overrides });

// ── R1: a soaked 1-year-old ends the day ──
test("rainy keeps indoor and mixed but drops outdoor", () => {
  const places = [
    place({ id: "indoor", setting: "indoor" }),
    place({ id: "mixed", setting: "mixed" }),
    place({ id: "outdoor", setting: "outdoor" }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "rainy" })).map((p) => p.id);
  assert.deepEqual(kept, ["indoor", "mixed"]);
});

test("mixed survives the rainy filter because indoor shelter is still usable in rain", () => {
  const kept = filterPlaces([place({ id: "tivoli", setting: "mixed" })], withFilters({ weather: "rainy" }));
  assert.equal(kept.length, 1);
});

test("sunny keeps outdoor and mixed but drops indoor-only", () => {
  const places = [
    place({ id: "indoor", setting: "indoor" }),
    place({ id: "mixed", setting: "mixed" }),
    place({ id: "outdoor", setting: "outdoor" }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "sunny" })).map((p) => p.id);
  assert.deepEqual(kept, ["mixed", "outdoor"]);
});

// ── R2: what matters is room to move around; we carry a changing mat ──
test("the baby filter requires baby_friendly", () => {
  const places = [
    place({ id: "soft-play", baby_friendly: true, ages: ["baby", "toddler"] }),
    place({ id: "spiral-tower", baby_friendly: false, ages: ["baby", "child"] }),
  ];
  const kept = filterPlaces(places, withFilters({ ages: ["baby"] })).map((p) => p.id);
  assert.deepEqual(kept, ["soft-play"]);
});

test("the baby filter ignores changing_table, because we bring a portable mat", () => {
  const kept = filterPlaces(
    [place({ id: "no-table", baby_friendly: true, changing_table: false, ages: ["baby"] })],
    withFilters({ ages: ["baby"] }),
  );
  assert.equal(kept.length, 1, "a baby-friendly place with no changing table must still be offered");
});

test("selecting several ages keeps a place suitable for any of them", () => {
  const places = [
    place({ id: "for-child", ages: ["child", "adult"] }),
    place({ id: "for-adult", ages: ["adult"] }),
  ];
  const kept = filterPlaces(places, withFilters({ ages: ["child", "toddler"] })).map((p) => p.id);
  assert.deepEqual(kept, ["for-child"]);
});

// ── R3: nap windows are short ──
test("the under-one-hour bucket never returns a four-hour place", () => {
  const places = [place({ id: "quick", duration_minutes: 45 }), place({ id: "park", duration_minutes: 240 })];
  const kept = filterPlaces(places, withFilters({ duration: "<1h" })).map((p) => p.id);
  assert.deepEqual(kept, ["quick"]);
});

test("bucket boundaries are inclusive at the stated minute", () => {
  assert.equal(matchesDuration(60, "<1h"), true);
  assert.equal(matchesDuration(61, "<1h"), false);
  assert.equal(matchesDuration(61, "1-2h"), true);
  assert.equal(matchesDuration(120, "1-2h"), true);
  assert.equal(matchesDuration(240, "half-day"), true);
  assert.equal(matchesDuration(241, "full-day"), true);
  assert.equal(matchesDuration(600, "full-day"), true);
});

// ── R4: one box, no thinking about which field ──
test("search covers all six fields so a word never hides in the wrong one", () => {
  const target = place({
    name: "Louisiana", category: "art-museum", neighbourhood: "Humlebæk",
    nearest_metro: "Nørreport", tags: ["rainy-day"], description: "Sculpture garden by the sea.",
  });
  for (const query of ["louisiana", "art-museum", "humlebæk", "nørreport", "rainy-day", "sculpture"]) {
    assert.equal(searchPlace(target, query), true, `query "${query}" should match`);
  }
  assert.equal(searchPlace(target, "aquarium"), false);
});

test("search is case-insensitive and ignores surrounding whitespace", () => {
  assert.equal(searchPlace(place({ name: "Den Blå Planet" }), "  BLÅ  "), true);
});

// ── combination and housekeeping ──
test("filters combine as AND, so a rainy free quick option is genuinely all three", () => {
  const places = [
    place({ id: "yes", setting: "indoor", price_band: "free", duration_minutes: 50 }),
    place({ id: "too-long", setting: "indoor", price_band: "free", duration_minutes: 200 }),
    place({ id: "outdoors", setting: "outdoor", price_band: "free", duration_minutes: 50 }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "rainy", price: ["free"], duration: "<1h" }));
  assert.deepEqual(kept.map((p) => p.id), ["yes"]);
});

test("the gluten-free filter keeps only places with reliable options", () => {
  const places = [
    place({ id: "good", gluten_free: "good" }),
    place({ id: "limited", gluten_free: "limited" }),
    place({ id: "none", gluten_free: "none" }),
  ];
  const kept = filterPlaces(places, withFilters({ glutenFree: true })).map((p) => p.id);
  assert.deepEqual(kept, ["good"], "limited is not reliable enough to plan a coeliac meal around");
});

test("no filters returns everything in the original order", () => {
  const places = [place({ id: "a" }), place({ id: "b" }), place({ id: "c" })];
  assert.deepEqual(filterPlaces(places, EMPTY_FILTERS).map((p) => p.id), ["a", "b", "c"]);
});

test("activeFilterCount reports how many filters are on, for a clear-all affordance", () => {
  assert.equal(activeFilterCount(EMPTY_FILTERS), 0);
  assert.equal(activeFilterCount(withFilters({ weather: "rainy", ages: ["baby"], query: "tivoli" })), 3);
});
