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

// TRIP-4 (td-920b3a): day trips are checked against the wider regional box,
// and only places the generator flagged as day trips get that slack.
const REGION_BBOX = { west: 11.84, east: 13.30, south: 55.24, north: 56.12 };
const LOUISIANA = { id: "louisiana-museum-of-modern-art", lat: 55.9696, lon: 12.5430 };

test("a flagged day trip outside the metro box passes inside the regional box", () => {
  const problems = validatePlace(validPlace({ ...LOUISIANA, day_trip: true }), {
    bbox: BBOX, regionBbox: REGION_BBOX, knownIds: new Set(),
  });
  assert.deepEqual(problems, []);
});

test("the regional box is not a loophole: an unflagged place at Louisiana is still outside the trip bbox", () => {
  const problems = validatePlace(validPlace(LOUISIANA), { bbox: BBOX, regionBbox: REGION_BBOX, knownIds: new Set() });
  assert.match(problems.join(" "), /outside trip bbox/);
});

test("a day trip beyond a day's reach is still rejected", () => {
  // Aarhus: a real Danish city, three hours away.
  const problems = validatePlace(validPlace({ lat: 56.1572, lon: 10.2107, day_trip: true }), {
    bbox: BBOX, regionBbox: REGION_BBOX, knownIds: new Set(),
  });
  assert.match(problems.join(" "), /outside trip region_bbox/);
});

test("a dataset with a day trip but no region_bbox fails loudly instead of skipping the check", () => {
  const data = {
    trip: { city: "Copenhagen", country: "Denmark", from: "2026-08-02", to: "2026-08-08", bbox: BBOX },
    places: [validPlace({ ...LOUISIANA, day_trip: true })],
  };
  assert.match(validateDataset(data).join(" "), /region_bbox/);
});

test("a dataset with region_bbox accepts its flagged day trips", () => {
  const data = {
    trip: { city: "Copenhagen", country: "Denmark", from: "2026-08-02", to: "2026-08-08", bbox: BBOX, region_bbox: REGION_BBOX },
    places: [validPlace(), validPlace({ ...LOUISIANA, day_trip: true })],
  };
  assert.deepEqual(validateDataset(data), []);
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
