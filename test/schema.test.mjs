import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlace, validateDataset, DURATION_BUCKETS, ENUMS } from "../src/schema.mjs";

const BBOX = { west: 12.40, east: 12.70, south: 55.60, north: 55.75 };

function validPlace(overrides = {}) {
  return {
    id: "tivoli", name: "Tivoli Gardens", kind: "attraction", category: "theme-park",
    neighbourhood: "Indre By", lat: 55.6736, lon: 12.5681,
    description: "A long enough description to be useful to a family reading it.",
    duration_minutes: 240, price_band: "€€€", booking: "recommended",
    website: "https://www.tivoli.dk/en/", maps_url: "https://maps.example/1",
    setting: "mixed", ages: ["toddler", "child", "adult"], baby_friendly: true,
    stroller: true, changing_table: true, gluten_free: "limited",
    nearest_metro: "København H", tags: ["classic"], near: [],
    ...overrides,
  };
}

test("a well-formed place has no problems", () => {
  assert.deepEqual(validatePlace(validPlace(), { bbox: BBOX, knownIds: new Set() }), []);
});

test("a place outside the trip bbox is rejected, because that is how a hallucinated city is caught", () => {
  // Malmö, Sweden — plausible-looking, wrong country.
  const problems = validatePlace(validPlace({ lat: 55.6050, lon: 13.0038 }), { bbox: BBOX, knownIds: new Set() });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /outside trip bbox/);
});

test("an unknown enum value is rejected rather than passed through to the UI", () => {
  const problems = validatePlace(validPlace({ price_band: "$$" }), { bbox: BBOX, knownIds: new Set() });
  assert.match(problems.join(" "), /price_band/);
});

test("a missing required field is reported by name", () => {
  const place = validPlace();
  delete place.description;
  const problems = validatePlace(place, { bbox: BBOX, knownIds: new Set() });
  assert.match(problems.join(" "), /description/);
});

test("a dangling near[].id is rejected, because near[] is computed by us so a broken ref is our own bug", () => {
  const problems = validatePlace(
    validPlace({ near: [{ id: "does-not-exist", walk_minutes: 4 }] }),
    { bbox: BBOX, knownIds: new Set(["tivoli"]) },
  );
  assert.match(problems.join(" "), /does-not-exist/);
});

test("duplicate ids are rejected at dataset level", () => {
  const data = {
    trip: { city: "Copenhagen", country: "Denmark", from: "2026-08-02", to: "2026-08-08", bbox: BBOX },
    places: [validPlace(), validPlace()],
  };
  assert.match(validateDataset(data).join(" "), /duplicate id/i);
});

test("duration buckets do not overlap and cover every positive duration", () => {
  const ranges = Object.values(DURATION_BUCKETS).sort((a, b) => a[0] - b[0]);
  assert.equal(ranges[0][0], 0);
  for (let i = 1; i < ranges.length; i += 1) {
    assert.equal(ranges[i][0], ranges[i - 1][1] + 1, "buckets must be contiguous with no gap or overlap");
  }
  assert.equal(ranges.at(-1)[1], Infinity);
});

test("the enums are exactly the values the spec fixes", () => {
  assert.deepEqual([...ENUMS.price_band], ["free", "€", "€€", "€€€"]);
  assert.deepEqual([...ENUMS.kind], ["attraction", "playground", "restaurant"]);
  assert.deepEqual([...ENUMS.setting], ["indoor", "outdoor", "mixed"]);
});
