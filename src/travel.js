import { haversineMetres } from "../tools/geo.mjs";

const DETOUR = 1.25; // streets are not straight lines
const WALK = 60; // m/min, pram pace
const TRANSIT_SPEED = 400; // m/min ≈ 24 km/h effective, stops included
const TRANSIT_OVERHEAD = 10; // walk to the stop, plus waiting

function findZone(place, zones) {
  for (const [key, def] of Object.entries(zones)) {
    if (def.members.includes(place.neighbourhood)) return key;
  }
  return null;
}

// Same zone, or a pair the table doesn't cover: null tells the caller to fall
// through to the heuristic rather than throw. A missing number should degrade
// to a rough answer, never to a broken screen.
function zoneMinutes(a, b, zonesConfig) {
  if (!zonesConfig) return null;
  const { zones, zone_minutes } = zonesConfig;
  const zoneA = findZone(a, zones);
  const zoneB = findZone(b, zones);
  if (!zoneA || !zoneB || zoneA === zoneB) return null;
  const key = [zoneA, zoneB].sort().join("|");
  const minutes = zone_minutes[key];
  return typeof minutes === "number" ? minutes : null;
}

// D4: last stop on the active day → trip base → city centre. Anchoring on the
// last stop is what turns browsing into routing; base covers morning
// planning before anything is ticked; the bbox-derived centre is the one
// fallback that always exists, so the chain never comes back empty.
export function resolveAnchor({ places, days, activeDate, base, bbox }) {
  const lastStopId = activeDate ? (days[activeDate] ?? []).at(-1) : undefined;
  if (lastStopId) {
    const place = places.find((p) => p.id === lastStopId);
    if (place && typeof place.lat === "number") {
      return { point: { lat: place.lat, lon: place.lon, neighbourhood: place.neighbourhood }, label: place.name };
    }
  }
  if (base) return { point: base, label: "your base" };
  return { point: { lat: (bbox.north + bbox.south) / 2, lon: (bbox.east + bbox.west) / 2 }, label: "the city centre" };
}

export function travelMinutes(a, b, zonesConfig) {
  const override = zoneMinutes(a, b, zonesConfig); // branch B
  if (override !== null) return { minutes: override, mode: "transit" };

  const d = haversineMetres(a, b) * DETOUR; // branch A
  const walk = d / WALK;
  const ride = TRANSIT_OVERHEAD + d / TRANSIT_SPEED;
  return walk <= ride
    ? { minutes: Math.round(walk), mode: "walk" }
    : { minutes: Math.round(ride), mode: "transit" };
}

// Legs only exist between two real, geolocated stops — an unknown place (its
// id survived a dataset regeneration that dropped it) has no lat/lon to route
// from, so the leg either side of it is left out rather than guessed at.
export function routeMinutes(stops, zonesConfig) {
  let total = 0;
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (typeof a.lat !== "number" || typeof b.lat !== "number") {
      legs.push(null);
      continue;
    }
    const leg = travelMinutes(a, b, zonesConfig);
    total += leg.minutes;
    legs.push(leg);
  }
  return { legs, total };
}

// D7: exact optimisation, not a heuristic. The first stop stays fixed as the
// day's starting point — Auto Re-Order proposes a sequence for what's left to
// visit, not a different place to start from — so the search is over the
// remaining (n-1)! orderings. At the 8-stop cap that's 7! = 5040, cheap enough
// that approximating it would be a worse answer for no saving.
export const MAX_AUTO_REORDER_STOPS = 8;

function* permutations(items) {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i], ...tail];
  }
}

export function proposeOrder(stops, zonesConfig) {
  if (stops.length < 2) return { order: stops.map((s) => s.id), movingMinutes: 0 };
  const [first, ...rest] = stops;
  let best = null;
  for (const tail of permutations(rest)) {
    const sequence = [first, ...tail];
    const { total } = routeMinutes(sequence, zonesConfig);
    if (best === null || total < best.total) best = { sequence, total };
  }
  return { order: best.sequence.map((s) => s.id), movingMinutes: best.total };
}
