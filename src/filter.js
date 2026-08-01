import { DURATION_BUCKETS } from "./schema.mjs";

export const EMPTY_FILTERS = Object.freeze({
  weather: null,      // null | "rainy" | "sunny"
  ages: [],           // subset of baby | toddler | child | adult
  price: [],          // subset of free | € | €€ | €€€
  duration: null,     // null | key of DURATION_BUCKETS
  kind: null,         // null | attraction | playground | restaurant
  glutenFree: false,
  query: "",
  sort: null,        // null | "distance"
});

const WEATHER_SETTINGS = { rainy: ["indoor", "mixed"], sunny: ["outdoor", "mixed"] };

const SEARCH_FIELDS = ["name", "description", "category", "neighbourhood", "nearest_metro"];

export function matchesDuration(minutes, bucketKey) {
  const range = DURATION_BUCKETS[bucketKey];
  if (!range) return true;
  return minutes >= range[0] && minutes <= range[1];
}

export function searchPlace(place, query) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  for (const field of SEARCH_FIELDS) {
    if (String(place[field] ?? "").toLowerCase().includes(needle)) return true;
  }
  return (place.tags ?? []).some((tag) => tag.toLowerCase().includes(needle));
}

// A place suits an age if it lists that age. "baby" is special: it additionally
// requires room for a 1-year-old to move around, and deliberately says nothing
// about changing facilities.
function matchesAge(place, age) {
  if (age === "baby") return place.baby_friendly === true;
  return (place.ages ?? []).includes(age);
}

export function filterPlaces(places, filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return places.filter((place) => {
    if (f.weather && !WEATHER_SETTINGS[f.weather].includes(place.setting)) return false;
    if (f.ages.length > 0 && !f.ages.some((age) => matchesAge(place, age))) return false;
    if (f.price.length > 0 && !f.price.includes(place.price_band)) return false;
    if (f.duration && !matchesDuration(place.duration_minutes, f.duration)) return false;
    if (f.kind && place.kind !== f.kind) return false;
    if (f.glutenFree && place.gluten_free !== "good") return false;
    if (!searchPlace(place, f.query)) return false;
    return true;
  });
}

export function activeFilterCount(filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return [
    f.weather !== null,
    f.ages.length > 0,
    f.price.length > 0,
    f.duration !== null,
    f.kind !== null,
    f.glutenFree,
    f.query.trim() !== "",
  ].filter(Boolean).length;
}
