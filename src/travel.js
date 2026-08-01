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
