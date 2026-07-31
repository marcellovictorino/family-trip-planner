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
