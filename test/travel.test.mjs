import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { travelMinutes } from "../src/travel.js";

const TIVOLI = { lat: 55.6736, lon: 12.5681, neighbourhood: "Vesterbro" };
const GLYPTOTEKET = { lat: 55.6725, lon: 12.5729, neighbourhood: "Vesterbro" }; // ~320 m
const FAR = { lat: 55.6552, lon: 12.5964, neighbourhood: "Amager" }; // ~2.2 km from Tivoli

test("a short hop stays a walk", () => {
  const { mode } = travelMinutes(TIVOLI, GLYPTOTEKET);
  assert.equal(mode, "walk");
});

test("mode flips to transit once the heuristic ride beats the walk", () => {
  const { mode, minutes } = travelMinutes(TIVOLI, FAR);
  assert.equal(mode, "transit");
  assert.ok(minutes > 0);
});

test("a missing zone pair falls back to the heuristic rather than throwing", () => {
  const zonesConfig = {
    zones: { a: { members: ["Vesterbro"] }, b: { members: ["Amager"] } },
    zone_minutes: {}, // covers neither pair — must not throw
  };
  assert.doesNotThrow(() => travelMinutes(TIVOLI, FAR, zonesConfig));
  const withoutZones = travelMinutes(TIVOLI, FAR);
  const withZones = travelMinutes(TIVOLI, FAR, zonesConfig);
  assert.deepEqual(withZones, withoutZones, "no table entry means the heuristic answer, unchanged");
});

test("same zone never triggers the override, even if the pair happens to be self-referential", () => {
  const zonesConfig = {
    zones: { a: { members: ["Vesterbro"] } },
    zone_minutes: { "a|a": 1 },
  };
  const { mode } = travelMinutes(TIVOLI, GLYPTOTEKET, zonesConfig);
  assert.equal(mode, "walk", "same-zone pair must fall through to branch A, not a bogus same-zone override");
});

test("Indre By to Refshaleøen is not reported as a walk — the harbour crossing branch B exists for", () => {
  const dataset = JSON.parse(readFileSync(new URL("../data/copenhagen-2026.json", import.meta.url)));
  const zonesConfig = { zones: dataset.zones, zone_minutes: dataset.zone_minutes };
  const nyhavn = dataset.places.find((p) => p.name === "Nyhavn");
  const refshaleoen = dataset.places.find((p) => p.neighbourhood === "Refshaleøen");

  const heuristicOnly = travelMinutes(nyhavn, refshaleoen);
  const withZone = travelMinutes(nyhavn, refshaleoen, zonesConfig);

  assert.notEqual(withZone.mode, "walk");
  // The whole point of the zone table: the straight-line heuristic alone
  // under-states the harbour crossing, so the override must report it longer.
  assert.ok(withZone.minutes > heuristicOnly.minutes, "zone override must be truthful, not optimistic");
  assert.equal(withZone.minutes, 28);
});

test("a place with no matching zone falls back to the heuristic rather than throwing", () => {
  const zonesConfig = { zones: { a: { members: ["Vesterbro"] } }, zone_minutes: {} };
  const noNeighbourhood = { lat: 55.7, lon: 12.6 };
  assert.doesNotThrow(() => travelMinutes(TIVOLI, noNeighbourhood, zonesConfig));
});
