import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMetres, computeNear } from "../tools/geo.mjs";

const TIVOLI = { lat: 55.6736, lon: 12.5681 };
const GLYPTOTEKET = { lat: 55.6725, lon: 12.5729 };   // ~320 m east of Tivoli
const BLA_PLANET = { lat: 55.6329, lon: 12.6549 };    // ~7 km away

test("haversine matches a known short distance within 5%", () => {
  const metres = haversineMetres(TIVOLI, GLYPTOTEKET);
  assert.ok(metres > 300 && metres < 360, `expected ~320 m, got ${Math.round(metres)}`);
});

test("haversine is symmetric and zero for the same point", () => {
  assert.equal(haversineMetres(TIVOLI, TIVOLI), 0);
  assert.equal(
    Math.round(haversineMetres(TIVOLI, BLA_PLANET)),
    Math.round(haversineMetres(BLA_PLANET, TIVOLI)),
  );
});

test("computeNear links places inside the radius and excludes those outside", () => {
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
    { id: "bla-planet", ...BLA_PLANET, near: [] },
  ];
  const [tivoli, , blaPlanet] = computeNear(places, { radius: 800, pace: 60 });
  assert.deepEqual(tivoli.near.map((n) => n.id), ["glyptoteket"]);
  assert.deepEqual(blaPlanet.near, [], "7 km away must not be 'near'");
});

test("walk_minutes uses a slow family pace, not an adult one", () => {
  // 320 m at 60 m/min is ~5 min; at an adult 80 m/min it would be 4.
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
  ];
  const [tivoli] = computeNear(places, { radius: 800, pace: 60 });
  assert.equal(tivoli.near[0].walk_minutes, 5);
});

test("computeNear never links a place to itself", () => {
  const places = [{ id: "tivoli", ...TIVOLI, near: [] }];
  assert.deepEqual(computeNear(places, { radius: 800, pace: 60 })[0].near, []);
});

test("near[] is sorted nearest first so the UI can show the closest option", () => {
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
    { id: "far-ish", lat: 55.6700, lon: 12.5760, near: [] },
  ];
  const [tivoli] = computeNear(places, { radius: 800, pace: 60 });
  const distances = tivoli.near.map((n) => n.walk_minutes);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});
