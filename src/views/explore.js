import { h } from "../dom.js";
import { filterPlaces, activeFilterCount, EMPTY_FILTERS } from "../filter.js";

const GLYPH = { attraction: "🎡", playground: "🛝", restaurant: "🍽" };

const PRICE_LABEL = { free: "Free", "€": "€", "€€": "€€", "€€€": "€€€" };

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
    place.baby_friendly && { glyph: "👶", label: "Room for a baby to move around" },
    place.stroller && { glyph: "🛒", label: "Pram accessible" },
    place.setting === "indoor" && { glyph: "🌧", label: "Indoors" },
    place.setting === "mixed" && { glyph: "🌤", label: "Indoor and outdoor" },
    place.gluten_free === "good" && { glyph: "GF", label: "Good gluten-free options" },
    place.booking === "required" && { glyph: "🎫", label: "Booking required" },
  ]
    .filter(Boolean)
    .map((i) => h("span", { class: "icon", title: i.label, "aria-label": i.label }, i.glyph));
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
      { class: "facts" },
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

export function renderCard(place) {
  return h(
    "details",
    { class: `card kind-${place.kind}`, "data-id": place.id },
    h(
      "summary",
      {},
      h("span", { class: "band" }, `${GLYPH[place.kind]} ${place.category}`),
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, facts(place)),
      h("span", { class: "icons" }, icons(place)),
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
        h("button", { class: "chip clear", type: "button", onClick: () => onFilterChange({ ...EMPTY_FILTERS }) },
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
      ? h("p", { class: "empty" }, "Nothing matches those filters.")
      : h("div", { class: "cards" }, matching.map((place) => {
          const card = renderCard(place);
          card.querySelector(".detail").append(cardActions(place, actions));
          if (actions.isVisited(place.id)) card.classList.add("is-visited");
          return card;
        })),
  );
}
