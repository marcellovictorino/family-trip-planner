const EARTH_RADIUS_METRES = 6_371_008.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function haversineMetres(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

// A too-tight bounding box silently discards real places (Den Blå Planet at
// 12.6549°E fell outside a raw model box of east 12.62°), which is worse than
// a loud validation failure. Padding trades a little slack for that safety.
export function padBbox(box, fraction = 0.35) {
  const lonPad = (box.east - box.west) * fraction;
  const latPad = (box.north - box.south) * fraction;
  return {
    west: +(box.west - lonPad).toFixed(4), east: +(box.east + lonPad).toFixed(4),
    south: +(box.south - latPad).toFixed(4), north: +(box.north + latPad).toFixed(4),
  };
}

// Day trips (Louisiana at 55.97°N, Bakken just north of the metro box) are a
// real part of a city break but sit outside the metro box. They get their own
// box: the metro box widened by a day trip's reach on every side. 40 km covers
// Helsingør, Roskilde and Malmö — all genuine day trips — while Aarhus or
// Odense, three hours away, still fail. Only places the generator flags as
// day trips are checked against it; everything else keeps the metro box.
export const DAY_TRIP_REACH_KM = 40;
const KM_PER_DEGREE_LAT = 111.32;

export function regionBbox(box, km = DAY_TRIP_REACH_KM) {
  const midLat = (box.north + box.south) / 2;
  const latPad = km / KM_PER_DEGREE_LAT;
  const lonPad = km / (KM_PER_DEGREE_LAT * Math.cos(toRadians(midLat)));
  return {
    west: +(box.west - lonPad).toFixed(4), east: +(box.east + lonPad).toFixed(4),
    south: +(box.south - latPad).toFixed(4), north: +(box.north + latPad).toFixed(4),
  };
}

export function computeNear(places, { radius, pace }) {
  return places.map((place) => {
    const near = places
      .filter((other) => other.id !== place.id)
      .map((other) => ({ id: other.id, metres: haversineMetres(place, other) }))
      .filter((entry) => entry.metres <= radius)
      .sort((a, b) => a.metres - b.metres)
      .map((entry) => ({ id: entry.id, walk_minutes: Math.max(1, Math.round(entry.metres / pace)) }));
    return { ...place, near };
  });
}
