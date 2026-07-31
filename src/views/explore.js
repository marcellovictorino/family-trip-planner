import { h } from "../dom.js";

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

export function renderExplore(places) {
  if (places.length === 0) {
    return h("p", { class: "empty" }, "Nothing matches those filters.");
  }
  return h("div", { class: "cards" }, places.map(renderCard));
}
