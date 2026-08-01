import { h } from "../dom.js";
import { filterPlaces, activeFilterCount, EMPTY_FILTERS } from "../filter.js";
import { travelMinutes } from "../travel.js";

const PRICE_LABEL = { free: "Free", "€": "€", "€€": "€€", "€€€": "€€€" };

// Per FacilityIcon: "this product has no icon font and no SVG icons by
// design" — every facility is the documented emoji glyph, never hand-drawn.
const FACILITIES = {
  baby: { glyph: "👶", label: "Room for a baby to move around" },
  stroller: { glyph: "🛒", label: "Pram accessible" },
  indoor: { glyph: "🌧", label: "Indoors" },
  mixed: { glyph: "🌤", label: "Indoor and outdoor" },
  glutenFree: { glyph: "GF", label: "Good gluten-free options" },
  booking: { glyph: "🎫", label: "Booking required" },
};

function facilityIcon(facility) {
  const { glyph, label } = FACILITIES[facility];
  const isText = glyph === "GF";
  return h("span", {
    class: isText ? "facility-icon facility-icon--text" : "facility-icon",
    role: "img", "aria-label": label, title: label,
  }, glyph);
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

// A stored place id that the dataset no longer has (regenerated away) reads
// identically wherever it's shown — Itinerary and Saved both resolve to this.
// No duration_minutes: an unknown stop's length is unknown, not zero.
export function unknownPlace(id) {
  return { id, name: `${id} (no longer in the guide)` };
}

// Which cards were expanded before a re-render, keyed by data-id, and how to
// reopen them after the DOM is rebuilt from scratch. Attribute-based (not the
// `.open` IDL property) so it works the same on a real <details> and in the
// test harness's fake DOM.
export function collectOpenIds(container) {
  return new Set(
    [...container.querySelectorAll("details.card[open]")].map((el) => el.getAttribute("data-id")),
  );
}

export function restoreOpenIds(container, openIds) {
  if (!openIds || openIds.size === 0) return;
  for (const card of container.querySelectorAll("details.card")) {
    if (openIds.has(card.getAttribute("data-id"))) card.setAttribute("open", "");
  }
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

// Rebuilding every card on every keystroke is fine at a handful of places and
// janky at ~200 — debounce the commit so a full re-render happens once typing
// pauses, not on each character. Clearing the box (backspace to empty, or the
// input's native clear control) commits immediately: there is nothing to wait
// for once the search is gone. Module-level so the timer survives the fact
// that renderControls itself is a fresh call on every render.
const SEARCH_DEBOUNCE_MS = 120;
let searchDebounce = null;

function commitSearch(set, query) {
  clearTimeout(searchDebounce);
  if (query === "") {
    set({ query });
    return;
  }
  searchDebounce = setTimeout(() => set({ query }), SEARCH_DEBOUNCE_MS);
}

// D5: distance sort is an explicit control, never a silent default. The
// anchor renders as its own dismissible chip so the list never reorders
// without saying why — dismissing it turns the sort back off rather than
// picking a different anchor behind the user's back.
function sortControl(filters, anchor, set) {
  const active = filters.sort === "distance";
  return h(
    "div",
    { class: "chips" },
    chip("📍 Nearest first", active, () => set({ sort: active ? null : "distance" })),
    active &&
      anchor &&
      h(
        "span",
        { class: "chip anchor-chip" },
        `Sorted from ${anchor.label}`,
        h("button", {
          class: "anchor-dismiss", type: "button", "aria-label": "Stop sorting by distance",
          onClick: () => set({ sort: null }),
        }, "✕"),
      ),
  );
}

function renderControls(filters, onFilterChange, anchor) {
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
      onInput: (event) => commitSearch(set, event.target.value),
    }),
    sortControl(filters, anchor, set),
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

function noResults(count, onFilterChange) {
  return h(
    "div",
    { class: "empty-state-block" },
    h("p", { class: "empty-state" },
      h("span", { class: "glyph", "aria-hidden": "true" }, "🔍"),
      count > 0 ? "Nothing matches those filters. Try clearing some to see more places." : "No places in the guide yet."),
    count > 0 &&
      h("button", { class: "action", type: "button", onClick: () => onFilterChange({ ...EMPTY_FILTERS }) },
        "Clear filters"),
  );
}

// Sorting happens after filtering, over what's left to show — an unsorted
// row (no lat/lon left in the dataset) sinks to the end rather than throwing.
function sortByAnchor(matching, anchor, zonesConfig) {
  return matching
    .map((place) => ({
      place,
      minutes: typeof place.lat === "number" ? travelMinutes(anchor.point, place, zonesConfig).minutes : Infinity,
    }))
    .sort((a, b) => a.minutes - b.minutes);
}

export function renderExplore(places, { filters, onFilterChange, actions, anchor, zonesConfig }) {
  const matching = filterPlaces(places, filters);
  const sorting = filters.sort === "distance" && anchor;
  const rows = sorting
    ? sortByAnchor(matching, anchor, zonesConfig)
    : matching.map((place) => ({ place, minutes: null }));

  return h(
    "div",
    {},
    renderControls(filters, onFilterChange, anchor),
    h("p", { class: "count" }, `${matching.length} of ${places.length}`),
    rows.length === 0
      ? noResults(activeFilterCount(filters), onFilterChange)
      : h("div", { class: "cards" }, rows.map(({ place, minutes }) => {
          const card = renderCard(place);
          if (Number.isFinite(minutes)) {
            card.querySelector("summary").append(
              h("span", { class: "facts-line facts-line--distance" }, `~${minutes} min from ${anchor.label}`),
            );
          }
          card.querySelector(".detail").append(cardActions(place, actions));
          if (actions.isVisited(place.id)) card.classList.add("is-visited");
          return card;
        })),
  );
}
