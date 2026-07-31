export const ENUMS = Object.freeze({
  kind: Object.freeze(["attraction", "playground", "restaurant"]),
  setting: Object.freeze(["indoor", "outdoor", "mixed"]),
  price_band: Object.freeze(["free", "€", "€€", "€€€"]),
  booking: Object.freeze(["none", "recommended", "required"]),
  gluten_free: Object.freeze(["none", "limited", "good"]),
  ages: Object.freeze(["baby", "toddler", "child", "adult"]),
});

export const REQUIRED_PLACE_FIELDS = Object.freeze([
  "id", "name", "kind", "category", "neighbourhood", "lat", "lon", "description",
  "duration_minutes", "price_band", "booking", "website", "maps_url", "setting",
  "ages", "baby_friendly", "stroller", "gluten_free", "tags", "near",
]);

export const DURATION_BUCKETS = Object.freeze({
  "<1h": Object.freeze([0, 60]),
  "1-2h": Object.freeze([61, 120]),
  "half-day": Object.freeze([121, 240]),
  "full-day": Object.freeze([241, Infinity]),
});

export const WALK_METRES_PER_MINUTE = 60;
export const NEAR_RADIUS_METRES = 800;

const MIN_DESCRIPTION_LENGTH = 40;

export function validatePlace(place, { bbox, knownIds }) {
  const problems = [];
  const where = place?.id ?? place?.name ?? "<unidentified place>";

  if (!place || typeof place !== "object") return [`${where}: not an object`];

  for (const field of REQUIRED_PLACE_FIELDS) {
    if (place[field] === undefined || place[field] === null) problems.push(`${where}: missing ${field}`);
  }

  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (field === "ages") continue;
    const value = place[field];
    if (value !== undefined && value !== null && !allowed.includes(value)) {
      problems.push(`${where}: ${field} "${value}" is not one of ${allowed.join(", ")}`);
    }
  }

  if (Array.isArray(place.ages)) {
    for (const age of place.ages) {
      if (!ENUMS.ages.includes(age)) problems.push(`${where}: ages contains "${age}"`);
    }
  } else if (place.ages !== undefined) {
    problems.push(`${where}: ages must be an array`);
  }

  if (typeof place.lat === "number" && typeof place.lon === "number" && bbox) {
    const inside =
      place.lat >= bbox.south && place.lat <= bbox.north && place.lon >= bbox.west && place.lon <= bbox.east;
    if (!inside) problems.push(`${where}: lat/lon ${place.lat},${place.lon} outside trip bbox`);
  }

  if (typeof place.duration_minutes === "number" && place.duration_minutes <= 0) {
    problems.push(`${where}: duration_minutes must be positive`);
  }

  if (typeof place.description === "string" && place.description.length < MIN_DESCRIPTION_LENGTH) {
    problems.push(`${where}: description shorter than ${MIN_DESCRIPTION_LENGTH} characters`);
  }

  if (typeof place.id === "string" && !/^[a-z0-9-]+$/.test(place.id)) {
    problems.push(`${where}: id must be lower-case kebab-case`);
  }

  if (Array.isArray(place.near) && knownIds && knownIds.size > 0) {
    for (const ref of place.near) {
      if (!knownIds.has(ref?.id)) problems.push(`${where}: near[] references unknown id "${ref?.id}"`);
    }
  }

  return problems;
}

export function validateDataset(data) {
  const problems = [];
  const trip = data?.trip;
  if (!trip) return ["dataset: missing trip"];
  for (const field of ["city", "country", "from", "to", "bbox"]) {
    if (!trip[field]) problems.push(`trip: missing ${field}`);
  }
  if (!Array.isArray(data.places) || data.places.length === 0) return [...problems, "dataset: no places"];

  const seen = new Set();
  for (const place of data.places) {
    if (seen.has(place?.id)) problems.push(`duplicate id "${place.id}"`);
    seen.add(place?.id);
  }
  for (const place of data.places) {
    problems.push(...validatePlace(place, { bbox: trip.bbox, knownIds: seen }));
  }
  return problems;
}
