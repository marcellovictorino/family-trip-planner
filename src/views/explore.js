import { h } from "../dom.js";
import { filterPlaces, activeFilterCount, EMPTY_FILTERS } from "../filter.js";

const PRICE_LABEL = { free: "Free", "€": "€", "€€": "€€", "€€€": "€€€" };

// Inline SVG per the FacilityIcon component — no icon font, no image requests.
const FACILITY_PATHS = {
  baby: '<circle cx="12" cy="7" r="3.4"/><path d="M6 20c0-4 2.7-7 6-7s6 3 6 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  stroller: '<path d="M4 10a8 4.5 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 10h16v2.5H4z"/><circle cx="7.5" cy="18.5" r="2"/><circle cx="16.5" cy="18.5" r="2"/><path d="M20 10.5l2-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  indoor: '<path d="M6.5 15a4 4 0 0 1 .3-8 5.6 5.6 0 0 1 10.5 2.1A4 4 0 0 1 17 15z"/><path d="M9 18.5v2M12 18v2.5M15 18.5v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mixed: '<circle cx="7.5" cy="8" r="3.2"/><path d="M7.5 2.8v1.4M2.8 8h1.4M4.5 4.5l1 1M11.5 4.5l-1 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10.5 17a3.6 3.6 0 0 1 .3-7.2 5 5 0 0 1 9.4 1.9A3.6 3.6 0 0 1 20.5 17z"/>',
  booking: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.3a1.6 1.6 0 0 0 0 3.4V14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.3a1.6 1.6 0 0 0 0-3.4z"/><path d="M12 6.5v9" stroke="var(--surface-card)" stroke-width="1.6" stroke-dasharray="2 2"/>',
};

const FACILITIES = {
  baby: { label: "Room for a baby to move around" },
  stroller: { label: "Pram accessible" },
  indoor: { label: "Indoors" },
  mixed: { label: "Indoor and outdoor" },
  glutenFree: { label: "Good gluten-free options" },
  booking: { label: "Booking required" },
};

function facilityIcon(facility) {
  const meta = FACILITIES[facility];
  if (facility === "glutenFree") {
    return h("span", { class: "facility-icon facility-icon--text", role: "img", "aria-label": meta.label, title: meta.label }, "GF");
  }
  const icon = h("span", { class: "facility-icon", role: "img", "aria-label": meta.label, title: meta.label });
  icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${FACILITY_PATHS[facility]}</svg>`;
  return icon;
}

function facts(place) {
  const bits = [place.neighbourhood, durationLabel(place.duration_minutes), PRICE_LABEL[place.price_band]];
  return bits.filter(Boolean).join(" · ");
}

export function durationLabel(minutes) {
  if (minutes <= 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h${minutes % 60}`;
}

function icons(place) {
  return [
    place.baby_friendly && "baby",
    place.stroller && "stroller",
    place.setting === "indoor" && "indoor",
    place.setting === "mixed" && "mixed",
    place.gluten_free === "good" && "glutenFree",
    place.booking === "required" && "booking",
  ]
    .filter(Boolean)
    .map(facilityIcon);
}

function detail(place) {
  return h(
    "div",
    { class: "detail" },
    h("p", {}, place.description),
    place.tips && h("p", { class: "tip" }, `Tip: ${place.tips}`),
    place.baby_notes && h("p", { class: "tip" }, `Baby: ${place.baby_notes}`),
    h(
      "dl",
      { class: "fact-list" },
      place.nearest_metro && [h("dt", {}, "Metro"), h("dd", {}, place.nearest_metro)],
      place.best_time && [h("dt", {}, "Best time"), h("dd", {}, place.best_time)],
      h("dt", {}, "Booking"),
      h("dd", {}, place.booking),
    ),
    h(
      "p",
      { class: "links" },
      place.website && h("a", { href: place.website, target: "_blank", rel: "noopener" }, "Website"),
      place.booking_url && h("a", { href: place.booking_url, target: "_blank", rel: "noopener" }, "Book"),
      place.maps_url && h("a", { href: place.maps_url, target: "_blank", rel: "noopener" }, "Map"),
    ),
  );
}

const KIND_GLYPH = { attraction: "🎡", playground: "🛝", restaurant: "🍽" };

export function renderCard(place) {
  return h(
    "details",
    { class: "card", "data-id": place.id },
    h(
      "summary",
      {},
      h("span", { class: "kind-band", "data-kind": place.kind },
        h("span", { "aria-hidden": "true" }, KIND_GLYPH[place.kind]), place.category),
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, facts(place)),
      h("span", { class: "facility-row" }, icons(place)),
    ),
    detail(place),
  );
}

const WEATHER_CHIPS = [
  { value: "rainy", label: "🌧 Rainy" },
  { value: "sunny", label: "☀️ Sunny" },
];
const AGE_CHIPS = [
  { value: "baby", label: "👶 Baby" },
  { value: "toddler", label: "🧒 Toddler" },
  { value: "child", label: "👧 6-year-old" },
];
const PRICE_CHIPS = ["free", "€", "€€", "€€€"].map((value) => ({ value, label: value === "free" ? "Free" : value }));
const DURATION_CHIPS = [
  { value: "<1h", label: "Under 1h" },
  { value: "1-2h", label: "1–2h" },
  { value: "half-day", label: "Half day" },
  { value: "full-day", label: "Full day" },
];
const KIND_CHIPS = [
  { value: "attraction", label: "🎡 Things to do" },
  { value: "playground", label: "🛝 Playgrounds" },
  { value: "restaurant", label: "🍽 Food" },
];

function chip(label, pressed, onClick) {
  return h("button", { class: "chip", type: "button", "aria-pressed": String(pressed), onClick }, label);
}

// A single-value group: tapping the active chip clears it.
function singleGroup(items, currentValue, onPick) {
  return items.map((item) =>
    chip(item.label, currentValue === item.value, () => onPick(currentValue === item.value ? null : item.value)),
  );
}

// A multi-value group: tapping toggles membership.
function multiGroup(items, currentList, onPick) {
  return items.map((item) =>
    chip(item.label, currentList.includes(item.value), () =>
      onPick(
        currentList.includes(item.value)
          ? currentList.filter((v) => v !== item.value)
          : [...currentList, item.value],
      ),
    ),
  );
}

function renderControls(filters, onFilterChange) {
  const set = (patch) => onFilterChange({ ...filters, ...patch });
  const count = activeFilterCount(filters);
  return h(
    "div",
    { class: "controls" },
    h("input", {
      class: "search",
      type: "search",
      value: filters.query,
      placeholder: "Search places, areas, metro…",
      "aria-label": "Search places",
      onInput: (event) => set({ query: event.target.value }),
    }),
    h(
      "div",
      { class: "chips" },
      singleGroup(WEATHER_CHIPS, filters.weather, (weather) => set({ weather })),
      multiGroup(AGE_CHIPS, filters.ages, (ages) => set({ ages })),
      singleGroup(KIND_CHIPS, filters.kind, (kind) => set({ kind })),
      singleGroup(DURATION_CHIPS, filters.duration, (duration) => set({ duration })),
      multiGroup(PRICE_CHIPS, filters.price, (price) => set({ price })),
      chip("GF", filters.glutenFree, () => set({ glutenFree: !filters.glutenFree })),
      count > 0 &&
        h("button", { class: "chip chip--dashed", type: "button", onClick: () => onFilterChange({ ...EMPTY_FILTERS }) },
          `Clear ${count}`),
    ),
  );
}

function cardActions(place, actions) {
  const favourite = actions.isFavourite(place.id);
  const visited = actions.isVisited(place.id);
  return h(
    "div",
    { class: "actions" },
    h("button", {
      class: "action", type: "button", "aria-pressed": String(favourite),
      "aria-label": `${favourite ? "Remove from" : "Add to"} favourites`,
      onClick: () => actions.onFavourite(place.id),
    }, favourite ? "♥ Saved" : "♡ Save"),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(visited),
      "aria-label": `Mark ${visited ? "not visited" : "visited"}`,
      onClick: () => actions.onVisited(place.id),
    }, visited ? "✓ Visited" : "✓ Visited?"),
    h("button", {
      class: "action primary", type: "button",
      onClick: () => actions.onAddToDay(place.id),
    }, "+ Add to day"),
  );
}

export function renderExplore(places, { filters, onFilterChange, actions }) {
  const matching = filterPlaces(places, filters);
  return h(
    "div",
    {},
    renderControls(filters, onFilterChange),
    h("p", { class: "count" }, `${matching.length} of ${places.length}`),
    matching.length === 0
      ? h("p", { class: "empty-state" }, h("span", { class: "glyph", "aria-hidden": "true" }, "🔍"), "Nothing matches those filters.")
      : h("div", { class: "cards" }, matching.map((place) => {
          const card = renderCard(place);
          card.querySelector(".detail").append(cardActions(place, actions));
          if (actions.isVisited(place.id)) card.classList.add("is-visited");
          return card;
        })),
  );
}
